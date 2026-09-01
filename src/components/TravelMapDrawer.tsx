import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { geoBounds, geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
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
  backdropClassName?: string;
  historyKey?: string;
  onRouteOpen?: () => void;
  chatId?: number | null;
  chatTitle?: string;
  chatType?: "direct" | "group";
  otherUser?: TinyUserDTO | null;
  focusLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  focusOwner?: TinyUserDTO | null;
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
  pointers: Map<number, { x: number; y: number; startX: number; startY: number }>;
  center: { x: number; y: number } | null;
  distance: number | null;
  moved: boolean;
  tapCountryCode: string | null;
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
type LocationFocusPhase = "idle" | "flying" | "arrived" | "selecting" | "focused";

const WIDTH = 920;
const HEIGHT = 500;
const INITIAL_GLOBE_ROTATION: [number, number] = [-104, -28];
const boundaryCache = new Map<string, FeatureCollection<Geometry, RegionProperties>>();
let countryIndexPromise: Promise<Array<{ code: string; available: boolean; bounds?: [number, number, number, number] }>> | null = null;

function mapPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  const renderedScale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  if (!Number.isFinite(renderedScale) || renderedScale <= 0) return { x: WIDTH / 2, y: HEIGHT / 2 };
  const contentWidth = WIDTH * renderedScale;
  const contentHeight = HEIGHT * renderedScale;
  return {
    x: (clientX - rect.left - (rect.width - contentWidth) / 2) / renderedScale,
    y: (clientY - rect.top - (rect.height - contentHeight) / 2) / renderedScale,
  };
}

function zoomTransformAroundPoint(current: MapTransform, nextScale: number, anchor: { x: number; y: number }, projectionScalesInternally: boolean) {
  if (nextScale <= 1) return { x: 0, y: 0, scale: 1 };
  const ratio = nextScale / current.scale;
  if (projectionScalesInternally) {
    return {
      scale: nextScale,
      x: anchor.x - WIDTH / 2 - ratio * (anchor.x - current.x - WIDTH / 2),
      y: anchor.y - HEIGHT / 2 - ratio * (anchor.y - current.y - HEIGHT / 2),
    };
  }
  return {
    scale: nextScale,
    x: anchor.x - ratio * (anchor.x - current.x),
    y: anchor.y - ratio * (anchor.y - current.y),
  };
}

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

export function TravelMapDrawer({ open, onClose, backdropClassName, historyKey = "travel-map", onRouteOpen, chatId, chatTitle, chatType, otherUser, focusLocation, focusOwner }: TravelMapDrawerProps) {
  const { session } = useAuth();
  const { language, t } = useI18n();
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
  const [locationFocusPhase, setLocationFocusPhase] = useState<LocationFocusPhase>("idle");
  const [locationFocusCandidate, setLocationFocusCandidate] = useState<CheckInCandidate | null>(null);
  const [locationFlashVisible, setLocationFlashVisible] = useState(false);
  const gestureRef = useRef<MapGesture>({ pointers: new Map(), center: null, distance: null, moved: false, tapCountryCode: null });
  const mapSvgRef = useRef<SVGSVGElement | null>(null);
  const avatarClipId = `travel-map-avatar-${useId().replace(/:/g, "")}`;

  const world = useMemo(worldFeatures, []);
  const currentUserId = session?.user.user_id;
  const mine = maps.find((item) => item.owner.user_id === currentUserId);
  const others = maps.filter((item) => item.owner.user_id !== currentUserId);
  const myCountries = useMemo(() => new Set((mine?.regions ?? []).map((item) => item.country_code)), [mine]);
  const otherCountries = useMemo(() => new Set(others.flatMap((item) => item.regions.map((region) => region.country_code))), [others]);

  useEffect(() => {
    if (!open) return;
    setGeometry(null);
    setTransform({ x: 0, y: 0, scale: 1 });
    setGlobeRotation(INITIAL_GLOBE_ROTATION);
    setLocationFocusPhase(focusLocation ? "flying" : "idle");
    setLocationFocusCandidate(null);
    setLocationFlashVisible(false);
    gestureRef.current = { pointers: new Map(), center: null, distance: null, moved: false, tapCountryCode: null };
  }, [focusLocation, open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    const request = focusLocation && focusOwner
      ? Promise.resolve(setMaps([{ owner: focusOwner, regions: [] }]))
      : chatId
      ? api.getChatTravelMaps(chatId, controller.signal).then((payload) => setMaps(payload.maps))
      : otherUser
        ? api.getTravelMap(otherUser.user_id, controller.signal).then((payload) => setMaps([
          { owner: payload.me, regions: payload.my_regions },
          { owner: payload.other, regions: payload.other_regions },
        ]))
        : api.getMyTravelMap(controller.signal).then((payload) => setMaps([{ owner: payload.owner, regions: payload.regions }]));
    if (!focusLocation && !chatId && !otherUser) {
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
  }, [open, chatId, focusLocation, focusOwner, otherUser?.user_id]);

  useEffect(() => {
    if (!open || focusLocation || !navigator.geolocation || !navigator.permissions) return;
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
  }, [focusLocation, open]);

  useEffect(() => {
    if (!open || !focusLocation) return;
    let cancelled = false;
    let frame = 0;
    const startedAt = performance.now();
    const duration = 1650;
    const targetRotation: [number, number] = [-focusLocation.longitude, -focusLocation.latitude];
    const startRotation = INITIAL_GLOBE_ROTATION;
    const longitudeDelta = ((targetRotation[0] - startRotation[0] + 540) % 360) - 180;
    const easeInOutCubic = (value: number) => value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
    const animate = (now: number) => {
      if (cancelled) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeInOutCubic(progress);
      setGlobeRotation([
        startRotation[0] + longitudeDelta * eased,
        startRotation[1] + (targetRotation[1] - startRotation[1]) * eased,
      ]);
      setTransform({ x: 0, y: 0, scale: 1 + 1.5 * eased });
      if (progress < 1) frame = requestAnimationFrame(animate);
      else setLocationFocusPhase("arrived");
    };
    frame = requestAnimationFrame(animate);
    void resolveTravelMapCandidates({
      latitude: focusLocation.latitude,
      longitude: focusLocation.longitude,
      accuracy: 0,
    }, language).then((candidates) => {
      if (!cancelled) setLocationFocusCandidate(candidates[0] ?? null);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [focusLocation, language, open]);

  useEffect(() => {
    if (locationFocusPhase !== "arrived") return;
    const timer = window.setTimeout(() => setLocationFocusPhase("selecting"), 520);
    return () => window.clearTimeout(timer);
  }, [locationFocusPhase]);

  useEffect(() => {
    if (locationFocusPhase !== "selecting" || !locationFocusCandidate) return;
    const revealFlash = window.setTimeout(() => setLocationFlashVisible(true), 420);
    const finishFocus = window.setTimeout(() => setLocationFocusPhase("focused"), 720);
    const hideFlash = window.setTimeout(() => setLocationFlashVisible(false), 1160);
    return () => {
      window.clearTimeout(revealFlash);
      window.clearTimeout(finishFocus);
      window.clearTimeout(hideFlash);
    };
  }, [locationFocusCandidate, locationFocusPhase]);

  useEffect(() => {
    const countryCode = locationFocusCandidate?.countryCode;
    if (!open || !focusLocation || !countryCode) {
      setGeometry(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void loadCountryBoundary(countryCode)
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
  }, [focusLocation, locationFocusCandidate?.countryCode, open]);

  const worldProjection = useMemo(() => geoOrthographic()
    .translate([WIDTH / 2, HEIGHT / 2])
    .scale(HEIGHT * 0.43 * transform.scale)
    .rotate(globeRotation)
    .clipAngle(90)
    .precision(0.35), [globeRotation, transform.scale]);
  const worldPath = useMemo(() => geoPath(worldProjection), [worldProjection]);
  const worldGraticule = useMemo(geoGraticule10, []);
  const displayedLocation = focusLocation ?? currentLocation;
  const displayedLocationOwner = focusOwner ?? session?.user;

  const currentLocationPoint = useMemo(() => {
    if (!displayedLocation) return null;
    const coordinate: [number, number] = [displayedLocation.longitude, displayedLocation.latitude];
    const globeCenter: [number, number] = [-globeRotation[0], -globeRotation[1]];
    return geoDistance(coordinate, globeCenter) <= Math.PI / 2 ? worldProjection(coordinate) : null;
  }, [displayedLocation, globeRotation, worldProjection]);
  const renderedLocationPoint = useMemo(() => {
    if (!currentLocationPoint) return null;
    return [currentLocationPoint[0] + transform.x, currentLocationPoint[1] + transform.y] as const;
  }, [currentLocationPoint, transform]);

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

  const maxZoom = focusLocation ? 8 : 4;
  const zoomAroundClientPoint = (scaleChange: (currentScale: number) => number, clientPoint?: { x: number; y: number }) => {
    const svg = mapSvgRef.current;
    const anchor = svg && clientPoint
      ? mapPointFromClient(svg, clientPoint.x, clientPoint.y)
      : { x: WIDTH / 2, y: HEIGHT / 2 };
    setTransform((current) => {
      const nextScale = Math.min(maxZoom, Math.max(1, scaleChange(current.scale)));
      return zoomTransformAroundPoint(current, nextScale, anchor, true);
    });
  };
  const zoom = (delta: number) => zoomAroundClientPoint((currentScale) => currentScale + delta);
  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setGlobeRotation(INITIAL_GLOBE_ROTATION);
  };
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAroundClientPoint((currentScale) => currentScale * factor, { x: event.clientX, y: event.clientY });
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
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });
    const metrics = gestureMetrics(gesture.pointers);
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
    if (gesture.pointers.size === 1) {
      gesture.moved = false;
      gesture.tapCountryCode = event.target instanceof Element
        ? event.target.closest<SVGPathElement>("[data-country-code]")?.dataset.countryCode ?? null
        : null;
    } else {
      gesture.moved = true;
      gesture.tapCountryCode = null;
    }
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;
    const previousCenter = gesture.center;
    const previousDistance = gesture.distance;
    const pointer = gesture.pointers.get(event.pointerId);
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: pointer?.startX ?? event.clientX,
      startY: pointer?.startY ?? event.clientY,
    });
    const metrics = gestureMetrics(gesture.pointers);
    if (!previousCenter || !metrics.center) return;
    const dx = metrics.center.x - previousCenter.x;
    const dy = metrics.center.y - previousCenter.y;
    if (pointer && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) {
      gesture.moved = true;
      gesture.tapCountryCode = null;
    }

    if (metrics.distance && previousDistance) {
      const ratio = metrics.distance / previousDistance;
      if (Math.abs(ratio - 1) > 0.002) {
        gesture.moved = true;
        zoomAroundClientPoint((currentScale) => currentScale * ratio, metrics.center);
      }
    }

    setGlobeRotation(([longitude, latitude]) => [
      longitude + dx * 0.32 / transform.scale,
      Math.min(82, Math.max(-82, latitude - dy * 0.32 / transform.scale)),
    ]);
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
  };
  const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    const shouldOpenCountry = !cancelled
      && gesture.pointers.size === 1
      && !gesture.moved
      && !focusLocation
      && gesture.tapCountryCode;
    gesture.pointers.delete(event.pointerId);
    const metrics = gestureMetrics(gesture.pointers);
    gesture.center = metrics.center;
    gesture.distance = metrics.distance;
    if (!gesture.pointers.size) {
      gesture.tapCountryCode = null;
      gesture.moved = false;
    }
    if (shouldOpenCountry) {
      const country = world.find((item) => countryCodeOf(item) === shouldOpenCountry);
      if (country) {
        const [[west, south], [east, north]] = geoBounds(country);
        setGlobeRotation([-(west + east) / 2, -(south + north) / 2]);
      }
    }
  };

  const title = focusLocation
    ? t("location.drawerTitle")
    : chatId
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
      backdropClassName={backdropClassName}
      historyKey={historyKey}
      onRouteOpen={onRouteOpen}
      open={open}
      onClose={onClose}
      title={title}
      headerAction={!focusLocation && !chatId && !otherUser ? (
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
        {focusLocation ? (
          <div className="travel-map-focus-address">
            <span className="material-symbols-outlined" aria-hidden="true">location_on</span>
            <strong>{focusLocation.address || t("location.shared")}</strong>
          </div>
        ) : null}
        <div className="travel-map-owner-row">
          <div className="travel-map-owner">
            <div className="travel-map-owner-avatars">
              {maps.slice(0, 4).map((item) => (
                <UserAvatar className="mini-avatar" key={item.owner.user_id} name={item.owner.name} uri={item.owner.avatar_uri} />
              ))}
            </div>
            <span>
              <strong>{focusLocation ? focusOwner?.name : chatId ? t("travelMap.sharedFootprints") : t("travelMap.myFootprints")}</strong>
              <small>{focusLocation ? t("location.focusing") : t("travelMap.regionCount", { count: totalRegions })}</small>
            </span>
          </div>
        </div>

        <div className="travel-map-canvas">
          <div className="travel-map-paper-heading">
            <span>{focusLocation ? t("location.focusing") : t("travelMap.worldAtlas")}</span>
            <strong>{focusLocation ? locationFocusCandidate?.regionName || locationFocusCandidate?.countryCode || t("travelMap.worldCode") : t("travelMap.worldCode")}</strong>
          </div>
          <svg
            aria-label={focusLocation ? focusLocation.address || t("location.shared") : t("travelMap.world")}
            onPointerCancel={(event) => handlePointerEnd(event, true)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onWheel={handleWheel}
            ref={mapSvgRef}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <g transform={`translate(${transform.x} ${transform.y})`}>
              <>
                  <path className="travel-map-globe-sphere" d={worldPath({ type: "Sphere" }) ?? undefined} />
                  <path className="travel-map-globe-graticule" d={worldPath(worldGraticule) ?? undefined} />
                  {world.map((country) => {
                const code = countryCodeOf(country);
                const path = worldPath(country);
                if (!code || !path) return null;
                return (
                  <path className={`travel-map-region is-${tone(myCountries, otherCountries, code)} is-country`} d={path} data-country-code={code} key={String(country.id)}>
                    <title>{countryName(code, language)}</title>
                  </path>
                );
                  })}
                  {focusLocation && geometry ? geometry.features.map((region, index) => {
                    const code = regionCode(locationFocusCandidate?.countryCode || "", region);
                    const name = region.properties?.name || code;
                    const path = worldPath(region);
                    const isTarget = code === locationFocusCandidate?.regionCode || name === locationFocusCandidate?.regionName;
                    return path ? (
                      <path className={`travel-map-focus-region${isTarget ? " is-target" : ""}`} d={path} key={`focus:${code}:${index}`}>
                        <title>{name}</title>
                      </path>
                    ) : null;
                  }) : null}
              </>
            </g>
          </svg>
          {renderedLocationPoint ? (
            <svg aria-hidden="true" className="travel-map-marker-layer" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
              <defs>
                <clipPath id={avatarClipId}><circle cx="0" cy="0" r="19" /></clipPath>
              </defs>
              <g className="travel-map-current-location-anchor" transform={`translate(${renderedLocationPoint[0]} ${renderedLocationPoint[1]})`}>
                <circle className="travel-map-current-location-pulse" r="20" />
                <circle className="travel-map-current-location-pulse is-delayed" r="20" />
                <g className="travel-map-current-avatar-svg">
                  <circle className="travel-map-current-avatar-background" r="20" />
                  <text className="travel-map-current-avatar-initial" dy="0.35em" textAnchor="middle">{(displayedLocationOwner?.name ?? t("travelMap.me")).slice(0, 1).toUpperCase()}</text>
                  {displayedLocationOwner?.avatar_uri ? (
                    <image clipPath={`url(#${avatarClipId})`} height="40" href={displayedLocationOwner.avatar_uri} preserveAspectRatio="xMidYMid slice" width="40" x="-20" y="-20" />
                  ) : null}
                  <circle className="travel-map-current-avatar-outline" r="20" />
                </g>
                {focusLocation && locationFocusPhase === "selecting" ? (
                  <g className="travel-map-focus-tap-svg" transform="translate(23 23)">
                    <circle r="14" />
                    <path d="M0-7v14M-7 0H7" />
                  </g>
                ) : null}
              </g>
            </svg>
          ) : null}
          {loading ? <div className="travel-map-loading"><span /></div> : null}
          {locationFlashVisible ? <div className="travel-map-focus-flash" aria-hidden="true" /> : null}
          <div className="travel-map-zoom">
            <button aria-label={t("travelMap.zoomOut")} disabled={transform.scale <= 1} onClick={() => zoom(-0.5)} type="button">−</button>
            <button aria-label={t("travelMap.resetZoom")} onClick={resetView} type="button">{Math.round(transform.scale * 100)}%</button>
            <button aria-label={t("travelMap.zoomIn")} disabled={transform.scale >= maxZoom} onClick={() => zoom(0.5)} type="button">＋</button>
          </div>
        </div>

        {!focusLocation ? <div className="travel-map-legend">
          <span><i className="is-mine" />{t("travelMap.mine")}</span>
          {others.length ? <span><i className="is-theirs" />{otherLegendLabel}</span> : null}
          {others.length ? <span><i className="is-overlap" />{t("travelMap.overlap")}</span> : null}
        </div> : null}

        {focusLocation ? (
          <a
            className="button travel-map-amap-button"
            href={`https://uri.amap.com/marker?${new URLSearchParams({
              position: `${focusLocation.longitude},${focusLocation.latitude}`,
              name: focusLocation.address || t("location.shared"),
              src: "Sermo",
              coordinate: "wgs84",
              callnative: "1",
            }).toString()}`}
            rel="noreferrer"
            target="_blank"
          >
            <span className="material-symbols-outlined" aria-hidden="true">map</span>
            {t("location.openInAmap")}
          </a>
        ) : null}

        {!focusLocation && !otherUser ? (
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
        historyKey="travel-map-access"
        onRouteOpen={() => setAccessOverviewOpen(true)}
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
        historyKey="travel-map-members"
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
