type FriendenLivingTheme = "frienden-night" | "frienden-garden";
type MotionKind = "breathe" | "peek" | "hop" | "sway" | "wag" | "water";

interface MotionZone {
  amplitude: number;
  center: [number, number];
  kind: MotionKind;
  phase: number;
  radius: [number, number];
  speed: number;
}

interface SceneDefinition {
  imageUrl: string;
  watering?: boolean;
  zones: MotionZone[];
}

const kindIndex: Record<MotionKind, number> = { breathe: 0, peek: 1, hop: 2, sway: 3, wag: 4, water: 5 };
const zone = (center: [number, number], radius: [number, number], kind: MotionKind, amplitude: number, speed: number, phase: number): MotionZone => ({ amplitude, center, kind, phase, radius, speed });

// Coordinates live in the source painting, so viewport cropping never changes the rig.
const SCENES: Record<FriendenLivingTheme, SceneDefinition> = {
  "frienden-night": {
    imageUrl: "/assets/frienden-wallpapers/night-rooms.webp",
    zones: [
      zone([.705, .845], [.095, .055], "peek", .008, .82, .2),
      zone([.905, .885], [.065, .045], "peek", .006, .71, 2.8),
      zone([.635, .695], [.115, .055], "wag", .005, 1.45, 1.2),
      zone([.155, .555], [.105, .065], "breathe", .006, 1.08, 4.3),
      zone([.815, .455], [.115, .065], "breathe", .006, .96, 2.1),
      zone([.225, .245], [.095, .075], "hop", .009, .66, 5.2),
      zone([.865, .205], [.085, .065], "breathe", .005, 1.02, 3.4),
      zone([.675, .065], [.09, .055], "hop", .007, .74, .8),
      zone([.145, .015], [.12, .055], "breathe", .005, .88, 2.7),
      zone([.66, .915], [.15, .11], "sway", .004, .73, 4.1),
      zone([.405, .72], [.14, .13], "sway", .004, .81, 1.4),
      zone([.84, .57], [.17, .13], "sway", .004, .69, 5.8),
      zone([.39, .12], [.15, .12], "sway", .004, .77, 2.5),
    ],
  },
  "frienden-garden": {
    imageUrl: "/assets/frienden-wallpapers/garden-rooms.webp",
    watering: true,
    zones: [
      zone([.235, .835], [.105, .065], "peek", .008, .78, 1.9),
      zone([.825, .89], [.095, .055], "peek", .007, .69, 4.7),
      zone([.525, .695], [.125, .075], "water", .007, .93, .6),
      zone([.825, .655], [.13, .09], "breathe", .006, .88, 3.5),
      zone([.105, .435], [.12, .07], "breathe", .006, 1.03, 1.4),
      zone([.545, .445], [.13, .08], "sway", .008, .72, 5.1),
      zone([.815, .39], [.105, .075], "peek", .008, .75, 2.7),
      zone([.18, .2], [.14, .085], "hop", .009, .68, 4.2),
      zone([.385, .17], [.12, .075], "wag", .006, 1.22, 1.1),
      zone([.545, .045], [.14, .075], "hop", .009, .64, 3.9),
      zone([.23, .79], [.23, .19], "sway", .004, .71, 2.3),
      zone([.79, .82], [.21, .18], "sway", .004, .63, 5.4),
      zone([.22, .285], [.22, .17], "sway", .004, .74, 1.7),
      zone([.82, .2], [.19, .2], "sway", .005, .67, 4.5),
    ],
  },
};

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = (aPosition + 1.0) * 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  #define MAX_ZONES 16
  uniform sampler2D uTexture;
  uniform vec2 uViewport;
  uniform vec2 uImage;
  uniform float uTime;
  uniform int uZoneCount;
  uniform bool uWatering;
  uniform vec4 uZones[MAX_ZONES];
  uniform vec4 uMotions[MAX_ZONES];
  varying vec2 vUv;

  vec2 coverUv(vec2 viewportUv) {
    float viewportAspect = uViewport.x / uViewport.y;
    float imageAspect = uImage.x / uImage.y;
    vec2 visible = vec2(1.0);
    if (viewportAspect > imageAspect) visible.y = imageAspect / viewportAspect;
    else visible.x = viewportAspect / imageAspect;
    vec2 anchor = vec2(.5, .52);
    return anchor + (viewportUv - anchor) * visible;
  }

  float softEllipse(vec2 uv, vec4 zone) {
    return 1.0 - smoothstep(.34, 1.0, length((uv - zone.xy) / zone.zw));
  }

  void main() {
    vec2 uv = coverUv(vUv);
    vec2 displaced = uv;
    for (int i = 0; i < MAX_ZONES; i++) {
      if (i >= uZoneCount) break;
      vec4 zone = uZones[i];
      vec4 motion = uMotions[i];
      float weight = softEllipse(uv, zone);
      float wave = sin(uTime * motion.y + motion.z);
      float kind = motion.w;
      vec2 local = (uv - zone.xy) / zone.zw;
      if (kind < .5) {
        displaced -= (uv - zone.xy) * wave * motion.x * weight;
        displaced.y += wave * motion.x * .16 * weight;
      } else if (kind < 1.5) {
        float lift = pow(max(0.0, wave), 3.0);
        displaced.y -= lift * motion.x * weight;
        displaced.x += sin(uTime * motion.y * .5 + motion.z) * motion.x * .18 * weight;
      } else if (kind < 2.5) {
        float hop = pow(max(0.0, wave), 5.0);
        displaced.y -= hop * motion.x * weight;
        displaced.x += wave * motion.x * .12 * weight;
      } else if (kind < 3.5) {
        displaced.x += wave * motion.x * weight * (.3 + max(0.0, local.y));
      } else if (kind < 4.5) {
        displaced.x += wave * motion.x * weight * (.35 + abs(local.x));
        displaced.y += abs(wave) * motion.x * .12 * weight;
      } else {
        displaced.x += wave * motion.x * .34 * weight;
        displaced.y -= max(0.0, wave) * motion.x * .48 * weight;
      }
    }

    vec4 color = texture2D(uTexture, displaced);
    if (uWatering) {
      for (int drop = 0; drop < 4; drop++) {
        float progress = fract(uTime * .28 + float(drop) * .23);
        vec2 dropCenter = vec2(.596 + progress * .075, .703 - progress * .045);
        vec2 shape = (uv - dropCenter) / vec2(.004, .007);
        float dropAlpha = (1.0 - smoothstep(.55, 1.0, length(shape))) * sin(progress * 3.14159);
        color.rgb = mix(color.rgb, vec3(.39, .73, .78), dropAlpha * .76);
      }
    }
    gl_FragColor = color;
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function mountFriendenLivingWallpaper(canvas: HTMLCanvasElement, theme: FriendenLivingTheme) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  const scene = SCENES[theme];
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) return () => undefined;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) return () => undefined;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => undefined;
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const zoneData = new Float32Array(16 * 4);
  const motionData = new Float32Array(16 * 4);
  scene.zones.forEach((item, index) => {
    zoneData.set([...item.center, ...item.radius], index * 4);
    motionData.set([item.amplitude, item.speed, item.phase, kindIndex[item.kind]], index * 4);
  });
  gl.uniform4fv(gl.getUniformLocation(program, "uZones"), zoneData);
  gl.uniform4fv(gl.getUniformLocation(program, "uMotions"), motionData);
  gl.uniform1i(gl.getUniformLocation(program, "uZoneCount"), scene.zones.length);
  gl.uniform1i(gl.getUniformLocation(program, "uWatering"), scene.watering ? 1 : 0);
  gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let imageReady = false;
  let frame = 0;
  let active = true;
  let lastFrame = 0;
  const image = new Image();
  image.decoding = "async";
  image.src = scene.imageUrl;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(gl.getUniformLocation(program, "uViewport"), width, height);
    }
  };

  const render = (timestamp: number) => {
    frame = 0;
    if (!active || !imageReady || document.visibilityState !== "visible") return;
    if (timestamp - lastFrame >= 1000 / 30) {
      resize();
      gl.uniform1f(gl.getUniformLocation(program, "uTime"), timestamp / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      lastFrame = timestamp;
    }
    frame = requestAnimationFrame(render);
  };
  const start = () => {
    if (!frame && active && imageReady && document.visibilityState === "visible") frame = requestAnimationFrame(render);
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  const handleVisibility = () => document.visibilityState === "visible" ? start() : stop();
  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) start(); else stop();
  });

  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform2f(gl.getUniformLocation(program, "uImage"), image.naturalWidth, image.naturalHeight);
    imageReady = true;
    canvas.classList.add("is-ready");
    resize();
    start();
  };
  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    active = false;
    stop();
    image.onload = null;
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", handleVisibility);
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  };
}
