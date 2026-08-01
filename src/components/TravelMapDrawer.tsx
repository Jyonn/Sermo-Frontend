import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { geoBounds, geoContains, geoDistance, geoGraticule10, geoMercator, geoOrthographic, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";
import zhCountries from "i18n-iso-countries/langs/zh.json";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { SideDrawer } from "./SideDrawer";
import { BottomSheet } from "./BottomSheet";
import { UserAvatar } from "./UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { TinyUserDTO, TravelMapAccessOverviewDTO, TravelMapAccessOverviewEntryDTO, TravelMapRegionDTO } from "../types";

countries.registerLocale(enCountries);
countries.registerLocale(zhCountries);

interface TravelMapDrawerProps {
  open: boolean;
  onClose: () => void;
  chatId?: number | null;
  chatTitle?: string;
  chatType?: "direct" | "group";
  otherUser?: TinyUserDTO | null;
}

interface RegionProperties {
  name?: string;
  code?: string;
}

interface MapOwner {
  owner: TinyUserDTO;
  regions: TravelMapRegionDTO[];
}

interface MapTransform {
  x: number;
  y: number;
  scale: number;
}

interface MapGesture {
  pointers: Map<number, { x: number; y: number }>;
  center: { x: number; y: number } | null;
  distance: number | null;
  moved: boolean;
}

export interface CheckInCandidate {
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
  isExact?: boolean;
}

export interface CheckInPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type CheckInPhase = "idle" | "locating" | "matching" | "saving";

const WIDTH = 920;
const HEIGHT = 500;
const INITIAL_GLOBE_ROTATION: [number, number] = [-104, -28];
const boundaryCache = new Map<string, FeatureCollection<Geometry, RegionProperties>>();
let countryIndexPromise: Promise<Array<{ code: string; available: boolean; bounds?: [number, number, number, number] }>> | null = null;

function worldFeatures() {
  const topology = worldTopology as unknown as { objects: { countries: Parameters<typeof feature>[1] } };
  return (feature(topology as never, topology.objects.countries) as unknown as FeatureCollection).features;
}

function countryCodeOf(item: Feature) {
  return countries.numericToAlpha3(String(item.id ?? "").padStart(3, "0")) || "";
}

function countryName(code: string, language: string) {
  return countries.getName(code, language === "zh-CN" ? "zh" : "en") || code;
}

function regionCode(country: string, item: Feature<Geometry, RegionProperties>) {
  return `${country}:${item.properties?.code || item.properties?.name || ""}`;
}

function normalizedRegionName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/special administrative region|autonomous region|municipality|province/g, "")
    .replace(/\u58ee\u65cf\u81ea\u6cbb\u533a|\u56de\u65cf\u81ea\u6cbb\u533a|\u7ef4\u543e\u5c14\u81ea\u6cbb\u533a|\u7279\u522b\u884c\u653f\u533a|\u81ea\u6cbb\u533a|\u7701|\u5e02/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function hasRegion(regions: TravelMapRegionDTO[], code: string, name: string) {
  const normalizedName = normalizedRegionName(name);
  return regions.some((item) => (
    item.region_code === code
    || (item.country_code === code.slice(0, 3) && normalizedRegionName(item.region_name) === normalizedName)
  ));
}

function rewindForD3(collection: FeatureCollection<Geometry, RegionProperties>) {
  const rewindGeometry = (geometry: Geometry): Geometry => {
    if (geometry.type === "Polygon") {
      return { ...geometry, coordinates: geometry.coordinates.map((ring) => [...ring].reverse()) };
    }
    if (geometry.type === "MultiPolygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())),
      };
    }
    if (geometry.type === "GeometryCollection") {
      return { ...geometry, geometries: geometry.geometries.map(rewindGeometry) };
    }
    return geometry;
  };
  return {
    ...collection,
    features: collection.features.map((item) => ({
      ...item,
      geometry: rewindGeometry(item.geometry),
    })),
  };
}

async function loadCountryBoundary(code: string) {
  const cached = boundaryCache.get(code);
  if (cached) return cached;
  const response = await fetch(`/maps/adm1/${code}.json`);
  if (!response.ok) return null;
  const collection = rewindForD3(await response.json() as FeatureCollection<Geometry, RegionProperties>);
  boundaryCache.set(code, collection);
  return collection;
}

async function loadCountryIndex() {
  if (!countryIndexPromise) {
    countryIndexPromise = fetch("/maps/index.json")
      .then((response) => response.ok ? response.json() : { countries: [] })
      .then((payload) => payload.countries ?? [])
      .catch(() => []);
  }
  return countryIndexPromise;
}

function accuracySamples(position: CheckInPosition) {
  const radius = Math.min(Math.max(position.accuracy, 20), 5000);
  const latitudeStep = radius / 111_320;
  const longitudeStep = latitudeStep / Math.max(Math.cos(position.latitude * Math.PI / 180), 0.15);
  return [
    [position.longitude, position.latitude],
    ...Array.from({ length: 8 }, (_, index) => {
      const angle = index * Math.PI / 4;
      return [
        position.longitude + Math.cos(angle) * longitudeStep,
        position.latitude + Math.sin(angle) * latitudeStep,
      ];
    }),
  ] as [number, number][];
}

export async function resolveTravelMapCandidates(position: CheckInPosition, language: string) {
  const samples = accuracySamples(position);
  const world = worldFeatures();
  const exactCountries = world
    .filter((item) => samples.some((point) => geoContains(item, point)))
    .map((item) => countryCodeOf(item))
    .filter(Boolean);
  let candidateCountries = exactCountries;
  if (!exactCountries.length) {
    const nearbyWorldCountries = world
      .filter((item) => {
        const [[west, south], [east, north]] = geoBounds(item);
        return position.latitude >= south - 0.25
          && position.latitude <= north + 0.25
          && position.longitude >= west - 0.25
          && position.longitude <= east + 0.25;
      })
      .map((item) => countryCodeOf(item))
      .filter(Boolean);
    const index = await loadCountryIndex();
    const indexedCountries = index
      .filter((item) => {
        if (!item.available || !item.bounds) return false;
        const [west, south, east, north] = item.bounds;
        return position.latitude >= south - 0.25
          && position.latitude <= north + 0.25
          && position.longitude >= west - 0.25
          && position.longitude <= east + 0.25;
      })
      .map((item) => item.code);
    candidateCountries = [...new Set([...nearbyWorldCountries, ...indexedCountries])];
  }
  const candidates: CheckInCandidate[] = [];
  for (const code of [...new Set(candidateCountries)]) {
    const countryLabel = countryName(code, language);
    const collection = await loadCountryBoundary(code);
    if (!collection) {
      candidates.push({
        regionCode: `COUNTRY:${code}`,
        regionName: countryLabel,
        countryCode: code,
        countryName: countryLabel,
        isExact: true,
      });
      continue;
    }
    collection.features.forEach((item) => {
      if (!samples.some((point) => geoContains(item, point))) return;
      const name = item.properties?.name || countryLabel;
      candidates.push({
        regionCode: regionCode(code, item),
        regionName: name,
        countryCode: code,
        countryName: countryLabel,
        isExact: geoContains(item, samples[0]),
      });
    });
    if (!candidates.some((item) => item.countryCode === code)) {
      const margin = Math.max(position.accuracy / 111_320, 0.15);
      collection.features.forEach((item) => {
        const [[west, south], [east, north]] = geoBounds(item);
        if (
          position.latitude < south - margin
          || position.latitude > north + margin
          || position.longitude < west - margin
          || position.longitude > east + margin
        ) return;
        const name = item.properties?.name || countryLabel;
        candidates.push({
          regionCode: regionCode(code, item),
          regionName: name,
          countryCode: code,
          countryName: countryLabel,
          isExact: false,
        });
      });
    }
  }
  return [...new Map(
    candidates.sort((left, right) => Number(right.isExact) - Number(left.isExact)).map((item) => [item.regionCode, item]),
  ).values()];
}

export function TravelMapDrawer({ open, onClose, chatId, chatTitle, chatType, otherUser }: TravelMapDrawerProps) {
  const { session } = useAuth();
  const { language, t } = useI18n();
  const [mode, setMode] = useState<"world" | "china">("china");
  const [selectedCountry, setSelectedCountry] = useState<string | null>("CHN");
  const [maps, setMaps] = useState<MapOwner[]>([]);
  const [geometry, setGeometry] = useState<FeatureCollection<Geometry, RegionProperties> | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInPhase, setCheckInPhase] = useState<CheckInPhase>("idle");
  const [checkInPosition, setCheckInPosition] = useState<CheckInPosition | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CheckInPosition | null>(null);
  const [checkInCandidates, setCheckInCandidates] = useState<CheckInCandidate[]>([]);
  const [accessOverview, setAccessOverview] = useState<TravelMapAccessOverviewDTO | null>(null);
  const [accessOverviewOpen, setAccessOverviewOpen] = useState(false);
  const [accessTab, setAccessTab] = useState<"shared_by_me" | "shared_with_me">("shared_by_me");
  const [accessDetail, setAccessDetail] = useState<TravelMapAccessOverviewEntryDTO | null>(null);
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const [globeRotation, setGlobeRotation] = useState<[number, number]>(INITIAL_GLOBE_ROTATION);
  const gestureRef = useRef<MapGesture>({ pointers: new Map(), center: null, distance: null, moved: false });
  const suppressCountryClickRef = useRef(false);

  const world = useMemo(worldFeatures, []);
  const activeCountry = mode === "china" ? "CHN" : selectedCountry;
  const currentUserId = session?.user.user_id;
  const mine = maps.find((item) => item.owner.user_id === currentUserId);
  const others = maps.filter((item) => item.owner.user_id !== currentUserId);
  const myRegions = mine?.regions ?? [];
  const otherRegions = useMemo(() => others.flatMap((item) => item.regions), [others]);
  const myCountries = useMemo(() => new Set((mine?.regions ?? []).map((item) => item.country_code)), [mine]);
  const otherCountries = useMemo(() => new Set(others.flatMap((item) => item.regions.map((region) => region.country_code))), [others]);

  useEffect(() => {
    if (!open) return;
    setMode("china");
    setSelectedCountry("CHN");
    setGeometry(null);
    setTransform({ x: 0, y: 0, scale: 1 });
    setGlobeRotation(INITIAL_GLOBE_ROTATION);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    const request = chatId
      ? api.getChatTravelMaps(chatId, controller.signal).then((payload) => setMaps(payload.maps))
      : otherUser
        ? api.getTravelMap(otherUser.user_id, controller.signal).then((payload) => setMaps([
          { owner: payload.me, regions: payload.my_regions },
          { owner: payload.other, regions: payload.other_regions },
        ]))
        : api.getMyTravelMap(controller.signal).then((payload) => setMaps([{ owner: payload.owner, regions: payload.regions }]));
    if (!chatId && !otherUser) {
      void api.getTravelMapAccessOverview(controller.signal)
        .then(setAccessOverview)
        .catch(() => {
          if (!controller.signal.aborted) setAccessOverview({ shared_by_me: [], shared_with_me: [] });
        });
    } else {
      setAccessOverview(null);
    }
    void request.catch((error) => {
      if (!controller.signal.aborted) showToast(error instanceof ApiError ? error.message : t("travelMap.loadFailed"), "error");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, chatId, otherUser?.user_id]);

  useEffect(() => {
    if (!open || !navigator.geolocation || !navigator.permissions) return;
    let cancelled = false;
    void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (cancelled || permission.state !== "granted") return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
      );
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeCountry) {
      setGeometry(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setTransform({ x: 0, y: 0, scale: 1 });
    void loadCountryBoundary(activeCountry)
      .then((payload) => {
        if (!payload) throw new Error("geometry unavailable");
        setGeometry(payload);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGeometry(null);
        showToast(t("travelMap.geometryFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeCountry, open]);

  const detailProjection = useMemo(() => geometry
    ? geoMercator().fitExtent([[26, 26], [WIDTH - 26, HEIGHT - 26]], geometry)
    : null, [geometry]);
  const detailPath = useMemo(() => detailProjection
    ? geoPath(detailProjection)
    : null, [detailProjection]);
  const worldProjection = useMemo(() => geoOrthographic()
    .translate([WIDTH / 2, HEIGHT / 2])
    .scale(HEIGHT * 0.43 * transform.scale)
    .rotate(globeRotation)
    .clipAngle(90)
    .precision(0.35), [globeRotation, transform.scale]);
  const worldPath = useMemo(() => geoPath(worldProjection), [worldProjection]);
  const worldGraticule = useMemo(geoGraticule10, []);
  const currentLocationPoint = useMemo(() => {
    if (!currentLocation) return null;
    const coordinate: [number, number] = [currentLocation.longitude, currentLocation.latitude];
    if (!activeCountry) {
      const globeCenter: [number, number] = [-globeRotation[0], -globeRotation[1]];
      return geoDistance(coordinate, globeCenter) <= Math.PI / 2 ? worldProjection(coordinate) : null;
    }
    if (!detailProjection || !geometry?.features.some((item) => {
      if (geoContains(item, coordinate)) return true;
      const [[west, south], [east, north]] = geoBounds(item);
      return currentLocation.latitude >= south - 0.15
        && currentLocation.latitude <= north + 0.15
        && currentLocation.longitude >= west - 0.15
        && currentLocation.longitude <= east + 0.15;
    })) return null;
    return detailProjection(coordinate);
  }, [activeCountry, currentLocation, detailProjection, geometry, globeRotation, worldProjection]);

  const tone = (mineSet: Set<string>, otherSet: Set<string>, code: string) => {
    if (mineSet.has(code) && otherSet.has(code)) return "overlap";
    if (mineSet.has(code)) return "mine";
    if (otherSet.has(code)) return "theirs";
    return "empty";
  };

  const saveCheckIn = async (position: CheckInPosition, candidate: CheckInCandidate) => {
    setCheckInPhase("saving");
    try {
      const payload = await api.checkInTravelMap({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy_meters: position.accuracy,
        region_code: candidate.regionCode,
        region_name: candidate.regionName,
        country_code: candidate.countryCode,
        country_name: candidate.countryName,
      });
      setMaps((current) => {
        if (!chatId) return [{ owner: payload.owner, regions: payload.regions }];
        const exists = current.some((item) => item.owner.user_id === payload.owner.user_id);
        return exists
          ? current.map((item) => item.owner.user_id === payload.owner.user_id ? { owner: payload.owner, regions: payload.regions } : item)
          : [...current, { owner: payload.owner, regions: payload.regions }];
      });
      setMode(payload.checked_region.country_code === "CHN" ? "china" : "world");
      setSelectedCountry(payload.checked_region.country_code);
      setCheckInCandidates([]);
      setCheckInPosition(null);
      showToast(t("travelMap.checkedIn", { region: payload.checked_region.region_name }));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.saveFailed"), "error");
    } finally {
      setCheckingIn(false);
      setCheckInPhase("idle");
    }
  };

  const resolveCheckIn = async (position: CheckInPosition) => {
    setCheckInPhase("matching");
    const unique = await resolveTravelMapCandidates(position, language);
    if (!unique.length) throw new Error("region unavailable");
    if (unique.length === 1) {
      await saveCheckIn(position, unique[0]);
      return;
    }
    setCheckInPosition(position);
    setCheckInCandidates(unique);
  };

  const checkIn = () => {
    if (otherUser || checkingIn) return;
    if (!navigator.geolocation) {
      showToast(t("travelMap.locationUnsupported"), "error");
      return;
    }
    setCheckingIn(true);
    setCheckInPhase("locating");
    window.setTimeout(() => {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const located = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };
            setCurrentLocation(located);
            void resolveCheckIn(located).catch((error) => {
              console.warn("[travel-map] region resolution failed", located, error);
              setCheckingIn(false);
              setCheckInPhase("idle");
              showToast(t("travelMap.regionNotFound"), "error");
            });
          },
          (error) => {
            setCheckingIn(false);
            setCheckInPhase("idle");
            showToast(
              error.code === error.PERMISSION_DENIED
                ? t("travelMap.locationPermissionDenied")
                : error.code === error.TIMEOUT
                  ? t("travelMap.locationTimeout")
                  : t("travelMap.locationFailed"),
              "error",
            );
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        );
      } catch {
        setCheckingIn(false);
        setCheckInPhase("idle");
        showToast(t("travelMap.locationFailed"), "error");
      }
    }, 0);
  };

  const zoom = (delta: number) => setTransform((current) => ({
    ...current,
    scale: Math.min(4, Math.max(1, current.scale + delta)),
  }));
  const resetView = () => {
    setMode("world");
    setSelectedCountry(null);
    setGeometry(null);
    setTransform({ x: 0, y: 0, scale: 1 });
    setGlobeRotation(INITIAL_GLOBE_ROTATION);
  };
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.25 : -0.25);
  };
  const gestureMetrics = (pointers: MapGesture["pointers"]) => {
    const points = [...pointers.values()];
    if (!points.length) return { center: null, distance: null };
    const center = {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
    const distance = points.length >= 2
      ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      : null;
    return { center, distance };
  };
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const metrics = gestureMetrics(gesture.pointers);
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
    if (gesture.pointers.size === 1) {
      gesture.moved = false;
      suppressCountryClickRef.current = false;
    }
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;
    const previousCenter = gesture.center;
    const previousDistance = gesture.distance;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const metrics = gestureMetrics(gesture.pointers);
    if (!previousCenter || !metrics.center) return;
    const dx = metrics.center.x - previousCenter.x;
    const dy = metrics.center.y - previousCenter.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) gesture.moved = true;

    if (metrics.distance && previousDistance) {
      const ratio = metrics.distance / previousDistance;
      if (Math.abs(ratio - 1) > 0.002) {
        gesture.moved = true;
        setTransform((current) => ({ ...current, scale: Math.min(4, Math.max(1, current.scale * ratio)) }));
      }
    }

    if (!activeCountry) {
      setGlobeRotation(([longitude, latitude]) => [
        longitude + dx * 0.32 / transform.scale,
        Math.min(82, Math.max(-82, latitude - dy * 0.32 / transform.scale)),
      ]);
    } else if (transform.scale > 1) {
      setTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    }
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
  };
  const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    gesture.pointers.delete(event.pointerId);
    suppressCountryClickRef.current = gesture.moved;
    const metrics = gestureMetrics(gesture.pointers);
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
  };
  const openCountry = (code: string) => {
    if (suppressCountryClickRef.current) {
      suppressCountryClickRef.current = false;
      return;
    }
    setSelectedCountry(code);
  };

  const title = chatId
    ? chatType === "direct"
      ? t("travelMap.directSharedTitle", { name: chatTitle || t("brand.user") })
      : (chatTitle || t("travelMap.sharedFootprints"))
    : otherUser
    ? t("travelMap.sharedTitle", { name: otherUser.name })
    : t("travelMap.myTitle");
  const totalRegions = maps.reduce((sum, item) => sum + item.regions.length, 0);
  const otherLegendLabel = chatType === "direct"
    ? (others[0]?.owner.name || chatTitle || t("travelMap.others"))
    : otherUser?.name || t("travelMap.others");

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={title}
      titleAccessory={!chatId && !otherUser ? (
        <button
          aria-label={t("travelMap.accessManagement")}
          className="travel-map-access-header-button"
          onClick={() => setAccessOverviewOpen(true)}
          title={t("travelMap.accessManagement")}
          type="button"
        >
          <span className="material-symbols-outlined" aria-hidden="true">key</span>
        </button>
      ) : null}
    >
      <div className="travel-map-drawer">
        <div className="travel-map-owner-row">
          <div className="travel-map-owner">
            <div className="travel-map-owner-avatars">
              {maps.slice(0, 4).map((item) => (
                <UserAvatar className="mini-avatar" key={item.owner.user_id} name={item.owner.name} uri={item.owner.avatar_uri} />
              ))}
            </div>
            <span><strong>{chatId ? t("travelMap.sharedFootprints") : t("travelMap.myFootprints")}</strong><small>{t("travelMap.regionCount", { count: totalRegions })}</small></span>
          </div>
          <div className="travel-map-view-switch">
            <button className={mode === "world" ? "is-active" : ""} onClick={resetView} type="button">{t("travelMap.world")}</button>
            <button className={mode === "china" ? "is-active" : ""} onClick={() => { setMode("china"); setSelectedCountry("CHN"); }} type="button">{t("travelMap.china")}</button>
          </div>
        </div>

        <div className="travel-map-canvas">
          <div className="travel-map-paper-heading">
            <span>{activeCountry ? t("travelMap.exploring") : t("travelMap.worldAtlas")}</span>
            <strong>{activeCountry || t("travelMap.worldCode")}</strong>
          </div>
          <svg
            aria-label={activeCountry ? countryName(activeCountry, language) : t("travelMap.world")}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onWheel={handleWheel}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <g transform={activeCountry ? `translate(${transform.x} ${transform.y}) scale(${transform.scale})` : undefined}>
              {!activeCountry ? (
                <>
                  <path className="travel-map-globe-sphere" d={worldPath({ type: "Sphere" }) ?? undefined} />
                  <path className="travel-map-globe-graticule" d={worldPath(worldGraticule) ?? undefined} />
                  {world.map((country) => {
                const code = countryCodeOf(country);
                const path = worldPath(country);
                if (!code || !path) return null;
                return (
                  <path className={`travel-map-region is-${tone(myCountries, otherCountries, code)} is-country`} d={path} key={String(country.id)} onClick={() => openCountry(code)}>
                    <title>{countryName(code, language)}</title>
                  </path>
                );
                  })}
                </>
              ) : geometry?.features.map((region, index) => {
                const code = regionCode(activeCountry, region);
                const name = region.properties?.name || code;
                const mineVisited = hasRegion(myRegions, code, name);
                const othersVisited = hasRegion(otherRegions, code, name);
                const path = detailPath?.(region);
                return path ? (
                  <path className={`travel-map-region is-${mineVisited && othersVisited ? "overlap" : mineVisited ? "mine" : othersVisited ? "theirs" : "empty"}`} d={path} key={`${code}:${index}`}>
                    <title>{name}</title>
                  </path>
                ) : null;
              })}
              {currentLocationPoint ? (
                <foreignObject
                  className="travel-map-current-location"
                  height="44"
                  width="44"
                  x={currentLocationPoint[0] - 22}
                  y={currentLocationPoint[1] - 22}
                >
                  <div>
                    <UserAvatar
                      className="travel-map-current-avatar"
                      name={session?.user.name ?? t("travelMap.me")}
                      uri={session?.user.avatar_uri}
                    />
                  </div>
                </foreignObject>
              ) : null}
            </g>
          </svg>
          {loading ? <div className="travel-map-loading"><span /></div> : null}
          <div className="travel-map-zoom">
            <button aria-label={t("travelMap.zoomOut")} disabled={transform.scale <= 1} onClick={() => zoom(-0.5)} type="button">−</button>
            <button aria-label={t("travelMap.resetZoom")} onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} type="button">{Math.round(transform.scale * 100)}%</button>
            <button aria-label={t("travelMap.zoomIn")} disabled={transform.scale >= 4} onClick={() => zoom(0.5)} type="button">＋</button>
          </div>
        </div>

        <div className="travel-map-legend">
          <span><i className="is-mine" />{t("travelMap.mine")}</span>
          {others.length ? <span><i className="is-theirs" />{otherLegendLabel}</span> : null}
          {others.length ? <span><i className="is-overlap" />{t("travelMap.overlap")}</span> : null}
        </div>

        {activeCountry ? (
          <button className="travel-map-country-back" onClick={resetView} type="button">
            <span>←</span>
            <span><strong>{countryName(activeCountry, language)}</strong><small>{t("travelMap.readOnlyRegions")}</small></span>
          </button>
        ) : null}

        {!otherUser ? (
          <button className="button travel-map-check-in-button" disabled={checkingIn} onClick={checkIn} type="button">
            {checkingIn ? <span className="travel-map-check-in-spinner" aria-hidden="true" /> : null}
            {checkInPhase === "locating"
              ? t("travelMap.locating")
              : checkInPhase === "matching"
                ? t("travelMap.matchingRegion")
                : checkInPhase === "saving"
                  ? t("travelMap.savingCheckIn")
                  : t("travelMap.checkInHere")}
          </button>
        ) : null}

      </div>
      <BottomSheet
        open={checkInCandidates.length > 1}
        title={t("travelMap.chooseCurrentRegion")}
        onClose={() => {
          setCheckInCandidates([]);
          setCheckInPosition(null);
          setCheckingIn(false);
          setCheckInPhase("idle");
        }}
      >
        <div className="travel-map-region-choices">
          {checkInCandidates.map((candidate) => (
            <button
              key={candidate.regionCode}
              onClick={() => {
                if (checkInPosition) void saveCheckIn(checkInPosition, candidate);
              }}
              type="button"
            >
              <strong>{candidate.regionName}</strong>
              <small>{candidate.countryName}</small>
            </button>
          ))}
        </div>
      </BottomSheet>
      <SideDrawer
        open={accessOverviewOpen}
        title={t("travelMap.accessManagement")}
        onClose={() => setAccessOverviewOpen(false)}
      >
        <div className="travel-map-access-overview">
          <div className="travel-map-access-tabs" role="tablist" aria-label={t("travelMap.accessManagement")}>
            <button aria-selected={accessTab === "shared_by_me"} className={accessTab === "shared_by_me" ? "is-active" : ""} onClick={() => setAccessTab("shared_by_me")} role="tab" type="button">
              {t("travelMap.sharedByMe")}
              <small>{accessOverview?.shared_by_me.length ?? 0}</small>
            </button>
            <button aria-selected={accessTab === "shared_with_me"} className={accessTab === "shared_with_me" ? "is-active" : ""} onClick={() => setAccessTab("shared_with_me")} role="tab" type="button">
              {t("travelMap.sharedWithMe")}
              <small>{accessOverview?.shared_with_me.length ?? 0}</small>
            </button>
          </div>
          {accessTab === "shared_by_me" ? (
            <section>
              {accessOverview?.shared_by_me.length ? accessOverview.shared_by_me.map((entry) => (
                <div className="travel-map-access-overview-row" key={`mine:${entry.chat_id}`}>
                  <span><strong>{entry.title}</strong><small>{entry.chat_type === "group" ? t("travelMap.groupMemberCount", { count: entry.users.length }) : t("travelMap.directChat")}</small></span>
                  <div className="travel-map-access-overview-avatars">
                    {entry.users.slice(0, 3).map((user) => <UserAvatar className="mini-avatar" key={user.user_id} name={user.name} uri={user.avatar_uri} />)}
                  </div>
                </div>
              )) : <p>{t("travelMap.noSharedByMe")}</p>}
            </section>
          ) : (
            <section>
              {accessOverview?.shared_with_me.length ? accessOverview.shared_with_me.map((entry) => {
                const content = (
                  <>
                    <span><strong>{entry.title}</strong><small>{entry.chat_type === "group" ? t("travelMap.authorizedMemberCount", { count: entry.users.length }) : entry.users[0]?.name}</small></span>
                    {entry.chat_type === "group" ? <span className="material-symbols-outlined">chevron_right</span> : (
                      <UserAvatar className="mini-avatar" name={entry.users[0]?.name ?? entry.title} uri={entry.users[0]?.avatar_uri} />
                    )}
                  </>
                );
                return entry.chat_type === "group" ? (
                  <button className="travel-map-access-overview-row" key={`theirs:${entry.chat_id}`} onClick={() => setAccessDetail(entry)} type="button">{content}</button>
                ) : (
                  <div className="travel-map-access-overview-row" key={`theirs:${entry.chat_id}`}>{content}</div>
                );
              }) : <p>{t("travelMap.noSharedWithMe")}</p>}
            </section>
          )}
        </div>
      </SideDrawer>
      <SideDrawer
        open={Boolean(accessDetail)}
        title={accessDetail?.title ?? t("travelMap.authorizedMembers")}
        onClose={() => setAccessDetail(null)}
      >
        <div className="travel-map-access-member-list">
          {accessDetail?.users.map((user) => (
            <div key={user.user_id}>
              <UserAvatar className="mini-avatar" name={user.name} uri={user.avatar_uri} />
              <strong>{user.name}</strong>
            </div>
          ))}
        </div>
      </SideDrawer>
    </SideDrawer>
  );
}
