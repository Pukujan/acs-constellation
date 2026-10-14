import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

import { WEBGL } from "@/lib/content";
import { BlackHole, SHADOW_RADIUS } from "@/lib/blackhole";
import { createLensingShader, lensGeometry } from "@/lib/lensing";
import {
  FrameMeter,
  bandAlpha,
  bandChroma,
  bandDelta,
  holeBypassRequested,
  lensBypassRequested,
  measurementMode,
  readBand,
  type SkyReadout,
} from "@/lib/sky-measure";
import { anchorSceneId, hash, type Vec3 } from "@/lib/sky";

export { anchorSceneId };

export interface SceneNode {
  id: string;
  position: Vec3;
  color: THREE.ColorRepresentation;
  size: number;
  /** Anchors are group markers: a thin ring and a label, never a selectable node. */
  kind: "node" | "anchor";
  label?: string;
  labelAlways?: boolean;
  /** The answering layer this point is clustered under, used for focus dimming. */
  cluster?: string;
}

export interface SceneLink {
  fromId: string;
  toId: string;
  color: THREE.ColorRepresentation;
  weight: number;
  /** The answering layer this link belongs to, so focus can dim the others. */
  cluster?: string;
}

interface Props {
  nodes: SceneNode[];
  links: SceneLink[];
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  ariaLabel: string;
  fallbackText: string;
  /** Increment to send the camera back to its starting position. */
  resetSignal?: number;
  /** Starting camera distance; smaller for a sky with fewer points. */
  homeDistance?: number;
  /**
   * How far above the orbital plane the camera starts. A flat view makes a ring
   * read as a line, so the smaller skies look down on the orbit instead.
   */
  homeElevation?: number;
  /** Draw the ACS Hotloader at the scene origin and orbit the graph around it. */
  hotloader?: boolean;
  /** Text under the hotloader. Rendered as a DOM label, so it stays in copy.json. */
  hotloaderLabel?: string;
  hotloaderNote?: string;
  /** Shift the whole graph down on short screens so copy can sit above it. */
  sinkOnNarrow?: boolean;
  /** Star shells and the graph scroll at different rates. */
  parallax?: boolean;
  /**
   * A layer id to light up. Everything else in the ramp dims and the camera
   * eases in on that cluster. The sky keeps turning underneath it.
   */
  focus?: string | null;
  /**
   * Play the opening approach move once, on mount. Only the hero asks for it:
   * the map is already an instrument the reader is holding.
   */
  intro?: boolean;
}

/* ------------------------------------------------------------- hit targets */

/**
 * How much wider a node's invisible pick sphere is than the star it wraps.
 * 3.4x puts a disc on screen that a thumb can land on without aiming at a point
 * of light, and `tools/check-tap-targets.mjs` proves it at 390x844.
 */
const HIT_RADIUS = 3.4;
/**
 * A star half a world unit wide is 12 pixels on a phone and 40 on a desktop
 * window, so a fixed multiplier cannot promise a thumb anything. Each target
 * also holds a minimum angle off the camera, and an angle is a promise: 0.032
 * radians is 31 pixels of pick radius at any depth, so the nearest star and the
 * faint one behind it are both easy to land on.
 */
const MIN_HIT_ANGULAR = 0.032;

/** A tap has to survive the drag that a rotate starts with. */
const TAP_DESKTOP_PX = 12;
const TAP_DESKTOP_MS = 700;
const TAP_TOUCH_PX = 28;
const TAP_TOUCH_MS = 900;

/* ----------------------------------------------------------- gesture zones */

/**
 * Where a gesture started decides who gets it. Inside the middle of the canvas
 * the sky rotates and zooms; near an edge the page keeps the gesture, so a
 * reader can always scroll away from a full-bleed sky. 20% of each axis, and
 * never a band thinner than 44px, which is the smallest thing a thumb is.
 */
const GESTURE_EDGE = 0.2;
const GESTURE_EDGE_PX = 44;

/**
 * The sky drifts on its own, but not while it is being held. A drag stops the
 * drift, and it comes back on a ramp so the turn never snaps.
 */
const AUTO_ROTATE_PAUSE_MS = 2600;
const AUTO_ROTATE_RAMP_MS = 1800;

/* ------------------------------------------------------------------ intro */

/**
 * The hero's first move: the camera arrives from further out and swings a few
 * degrees as it settles. Motion is the only thing that says "this moves", so the
 * sky says it once on load instead of a badge that has to be read.
 */
const INTRO_START_SCALE = 1.42;
const INTRO_ARC_RADIANS = 0.2;
const INTRO_SECONDS = 2.6;

/** A picked star is framed from this fraction of the home distance. */
const FRAME_DISTANCE_FACTOR = 0.45;

/* --------------------------------------------------------------- textures */

function radialTexture(kind: "glow" | "ring"): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    if (kind === "glow") {
      const g = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      // Whisper core, Twine tips. Nothing else.
      g.addColorStop(0, "rgba(242,243,248,1)");
      g.addColorStop(0.3, "rgba(242,243,248,0.5)");
      g.addColorStop(0.65, "rgba(200,160,106,0.14)");
      g.addColorStop(1, "rgba(200,160,106,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    } else {
      ctx.strokeStyle = "rgba(242,243,248,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------- component */

export default function Constellation({
  nodes,
  links,
  selectedId,
  onSelect,
  ariaLabel,
  fallbackText,
  resetSignal = 0,
  homeDistance = 28,
  homeElevation = 0.12,
  hotloader = false,
  hotloaderLabel,
  hotloaderNote,
  sinkOnNarrow = false,
  parallax = false,
  focus = null,
  intro = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  const coreLabelRef = useRef<HTMLDivElement | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const applySelectionRef = useRef<((id: string | null) => void) | null>(null);
  const applyFocusRef = useRef<((cluster: string | null) => void) | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  const labeledNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.label && (n.kind === "anchor" || n.labelAlways || n.id === selectedId),
      ),
    [nodes, selectedId],
  );

  const signature = useMemo(() => nodes.map((n) => n.id).join("|"), [nodes]);

  useEffect(() => {
    const host = hostRef.current;
    const canvasHost = canvasHostRef.current;
    if (!host || !canvasHost) return;

    const scene = new THREE.Scene();
    /*
     * `?fps&nohole` draws this sky with no hotloader at all, which is how the lensing
     * pass is proved inactive rather than merely invisible: on that path the composer is
     * never built and every frame goes to the canvas through the same call it used before
     * the pass existed. Without the flag nothing changes.
     */
    const drawHotloader = hotloader && !holeBypassRequested();
    let viewWidth = host.clientWidth || 1;
    let viewHeight = host.clientHeight || 1;
    const width = viewWidth;
    const height = viewHeight;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 400);
    const home = new THREE.Vector3(
      homeDistance * 0.055,
      homeDistance * homeElevation,
      homeDistance,
    );
    /*
     * The opening move is a swing through spherical coordinates, not a straight
     * line to home: the camera arrives further out and a little round the sky,
     * then settles on the framing the reader will drag from.
     */
    const homeSpherical = new THREE.Spherical().setFromVector3(home);
    const introSpherical = new THREE.Spherical(
      homeSpherical.radius * INTRO_START_SCALE,
      homeSpherical.phi,
      homeSpherical.theta + INTRO_ARC_RADIANS,
    );
    const playIntro = intro && !reduced;
    if (playIntro) {
      camera.position.setFromSpherical(introSpherical);
    } else {
      camera.position.copy(home);
    }
    let introT = playIntro ? 0 : 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    /*
     * The resting state gives the page its vertical scroll. A gesture that starts
     * inside the centre zone raises this to none for as long as it lasts, so the
     * sky can take a vertical drag too. See the zone check in the pointer code.
     */
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.setAttribute("aria-hidden", "true");
    canvasHost.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = homeDistance * 0.32;
    controls.maxDistance = homeDistance * 2;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    // A small drag should move the sky by a visible amount, then glide to a stop.
    controls.rotateSpeed = 1;
    controls.zoomSpeed = 1;
    /*
     * The sky drifts on its own, and stops when a hand takes over. `gestureUntil`
     * below is what pauses it; the drift returns on a ramp instead of snapping.
     */
    const driftSpeed = reduced ? 0.05 : 0.3;
    controls.autoRotate = true;
    controls.autoRotateSpeed = driftSpeed;
    /*
     * OrbitControls takes `touchAction` for itself when it connects, and the
     * value it wants is none, which would leave a phone unable to scroll past a
     * full-bleed sky. Re-assert the resting value after it is wired up: the zone
     * check raises it to none for a gesture that starts inside the middle.
     */
    renderer.domElement.style.touchAction = "pan-y";

    /*
     * Three rigid bodies. The graph orbits; the hotloader holds its own tilt so
     * the disk never swings edge-on with the orbit; the shells drift behind.
     */
    const graph = new THREE.Group();
    const core = new THREE.Group();
    scene.add(graph, core);
    const farShell = new THREE.Group();
    const nearShell = new THREE.Group();
    scene.add(farShell, nearShell);

    scene.add(new THREE.AmbientLight(WEBGL.whisper, 0.55));
    const key = new THREE.DirectionalLight(WEBGL.whisper, 0.9);
    key.position.set(9, 13, 11);
    scene.add(key);
    const rimLight = new THREE.PointLight(WEBGL.studio, 90, 90, 2);
    rimLight.position.set(-12, -7, -9);
    scene.add(rimLight);

    const glow = radialTexture("glow");
    const ring = radialTexture("ring");

    /* ------------------------------------------------------------ starfield */
    const makeStars = (
      count: number,
      rMin: number,
      rMax: number,
      twineShare: number,
    ) => {
      const position = new Float32Array(count * 3);
      const color = new Float32Array(count * 3);
      const whisper = new THREE.Color(WEBGL.whisper);
      const twine = new THREE.Color(WEBGL.twine);
      for (let i = 0; i < count; i += 1) {
        const r = rMin + Math.random() * (rMax - rMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        position[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        position[i * 3 + 1] = r * Math.cos(phi);
        position[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const c = Math.random() < twineShare ? twine : whisper;
        const k = 0.4 + Math.random() * 0.6;
        color[i * 3] = c.r * k;
        color[i * 3 + 1] = c.g * k;
        color[i * 3 + 2] = c.b * k;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
      const material = new THREE.PointsMaterial({
        size: 1.5,
        sizeAttenuation: true,
        map: glow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        opacity: 0.78,
      });
      return { geometry, material, points: new THREE.Points(geometry, material) };
    };

    const far = makeStars(900, 70, 190, 0.12);
    const near = makeStars(320, 40, 70, 0.22);
    farShell.add(far.points);
    nearShell.add(near.points);

    const geometries: THREE.BufferGeometry[] = [far.geometry, near.geometry];
    const materials: THREE.Material[] = [far.material, near.material];

    /* ------------------------------------------------------------ hotloader */
    /*
     * The hotloader hangs off its own group, not the orbiting graph, so its tilt
     * stays put while the sky turns around it. Six layers live inside it, and the
     * sky it bends is handled by the lensing pass below, not by any mesh.
     */
    let blackHole: BlackHole | null = null;

    if (drawHotloader) {
      blackHole = new BlackHole();
      core.add(blackHole.group);
    }

    /* ---------------------------------------------------------------- nodes */
    const coreGeometry = new THREE.SphereGeometry(1, 20, 16);
    geometries.push(coreGeometry);

    const meshes = new Map<string, THREE.Mesh>();
    const halos = new Map<string, THREE.Sprite>();
    const nodeMaterials = new Map<string, THREE.MeshStandardMaterial>();
    const haloMaterials = new Map<string, THREE.SpriteMaterial>();
    const anchorMaterials = new Map<string, THREE.SpriteMaterial>();
    const sizes = new Map(nodes.map((n) => [n.id, n.size]));
    const rest = new Map(nodes.map((n) => [n.id, new THREE.Vector3(...n.position)]));
    /*
     * Every star keeps its own clock. Amplitude, speed and phase come per axis
     * from the same id hash the layout scatters by, so no two neighbours pulse
     * together and the sky never moves as one synchronized bob. Built once, read
     * every frame, no allocation in the loop.
     */
    interface StarMotion {
      ax: number;
      ay: number;
      az: number;
      sx: number;
      sy: number;
      sz: number;
      px: number;
      py: number;
      pz: number;
      tw: number;
    }
    const motion = new Map<string, StarMotion>();
    nodes.forEach((n) => {
      const id = n.id;
      motion.set(id, {
        ax: 0.05 + hash(`${id}.ax`) * 0.1,
        ay: 0.1 + hash(`${id}.ay`) * 0.16,
        az: 0.05 + hash(`${id}.az`) * 0.1,
        sx: 0.14 + hash(`${id}.sx`) * 0.3,
        sy: 0.16 + hash(`${id}.sy`) * 0.34,
        sz: 0.12 + hash(`${id}.sz`) * 0.28,
        px: hash(`${id}.px`) * Math.PI * 2,
        py: hash(`${id}.py`) * Math.PI * 2,
        pz: hash(`${id}.pz`) * Math.PI * 2,
        tw: 0.45 + hash(`${id}.tw`) * 0.95,
      });
    });
    const clickable: THREE.Mesh[] = [];
    /*
     * A finger is wider than a cursor and slower to land, so each star carries
     * an invisible sphere around it as the pick target. `material.visible` keeps
     * the renderer from drawing it; the raycaster still reads the mesh.
     */
    const hitGeometry = new THREE.SphereGeometry(1, 10, 8);
    const hitMaterial = new THREE.MeshBasicMaterial();
    hitMaterial.visible = false;
    geometries.push(hitGeometry);
    materials.push(hitMaterial);
    const pickTargets = new Map<string, THREE.Mesh>();

    nodes.forEach((n) => {
      const color = new THREE.Color(n.color);
      const parent = drawHotloader ? graph : scene;

      if (n.kind === "anchor") {
        const spriteMaterial = new THREE.SpriteMaterial({
          map: ring,
          color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.5,
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.setScalar(n.size * 6);
        sprite.position.set(n.position[0], n.position[1], n.position[2]);
        parent.add(sprite);
        materials.push(spriteMaterial);
        anchorMaterials.set(n.id, spriteMaterial);
        return;
      }

      const nodeMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.75,
        roughness: 0.34,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(coreGeometry, nodeMaterial);
      mesh.scale.setScalar(n.size);
      mesh.position.set(n.position[0], n.position[1], n.position[2]);
      mesh.userData.id = n.id;
      parent.add(mesh);
      meshes.set(n.id, mesh);
      materials.push(nodeMaterial);
      nodeMaterials.set(n.id, nodeMaterial);

      const target = new THREE.Mesh(hitGeometry, hitMaterial);
      target.scale.setScalar(n.size * HIT_RADIUS);
      target.position.copy(mesh.position);
      target.userData.id = n.id;
      parent.add(target);
      pickTargets.set(n.id, target);
      clickable.push(target);

      const haloMaterial = new THREE.SpriteMaterial({
        map: glow,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.62,
      });
      const halo = new THREE.Sprite(haloMaterial);
      halo.scale.setScalar(n.size * 5.5);
      halo.position.copy(mesh.position);
      parent.add(halo);
      halos.set(n.id, halo);
      materials.push(haloMaterial);
      haloMaterials.set(n.id, haloMaterial);
    });

    /* ---------------------------------------------------------------- links */
    const linkPosition = new Float32Array(links.length * 6);
    const linkColor = new Float32Array(links.length * 6);
    links.forEach((l, i) => {
      const a = rest.get(l.fromId);
      const b = rest.get(l.toId);
      if (!a || !b) return;
      linkPosition.set(a.toArray(), i * 6);
      linkPosition.set(b.toArray(), i * 6 + 3);
      const c = new THREE.Color(l.color).multiplyScalar(Math.max(0.14, l.weight));
      linkColor.set([c.r, c.g, c.b], i * 6);
      linkColor.set([c.r, c.g, c.b], i * 6 + 3);
    });
    const baseLinkColor = new Float32Array(linkColor);
    const linkGeometry = new THREE.BufferGeometry();
    geometries.push(linkGeometry);
    linkGeometry.setAttribute("position", new THREE.BufferAttribute(linkPosition, 3));
    linkGeometry.setAttribute("color", new THREE.BufferAttribute(linkColor, 3));
    const linkMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    (drawHotloader ? graph : scene).add(new THREE.LineSegments(linkGeometry, linkMaterial));
    materials.push(linkMaterial);

    const activeGeometry = new THREE.BufferGeometry();
    geometries.push(activeGeometry);
    activeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(links.length * 6), 3),
    );
    const activeMaterial = new THREE.LineBasicMaterial({
      color: WEBGL.twine,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    (drawHotloader ? graph : scene).add(new THREE.LineSegments(activeGeometry, activeMaterial));
    materials.push(activeMaterial);

    let activeId: string | null = null;
    /**
     * A picked star is framed, not only lit. `t` runs 0 to 1 while the camera
     * swings round so the star faces the reader with the middle of the sky
     * behind it; a drag or a reset drops it straight away.
     */
    let framing: { id: string; t: number } | null = null;
    /** The distance tween shared by framing, cluster focus and the reset. */
    let tween: { from: number; to: number; t: number } | null = null;
    /**
     * Closing a record with no layer selected. Distance alone is not enough:
     * the framed bearing looks across the orbit, and pulling back along it
     * leaves the map edge-on. This eases the camera back to the home pose.
     */
    let returnHome: {
      t: number;
      fromCamera: THREE.Vector3;
      fromTarget: THREE.Vector3;
    } | null = null;
    let focusAnchorId: string | null = null;

    applySelectionRef.current = (id: string | null) => {
      activeId = id;
      const attribute = activeGeometry.getAttribute("position") as THREE.BufferAttribute;
      let count = 0;
      if (id) {
        links.forEach((l) => {
          if (l.fromId !== id && l.toId !== id) return;
          const a = rest.get(l.fromId);
          const b = rest.get(l.toId);
          if (!a || !b) return;
          attribute.setXYZ(count * 2, a.x, a.y, a.z);
          attribute.setXYZ(count * 2 + 1, b.x, b.y, b.z);
          count += 1;
        });
      }
      attribute.needsUpdate = true;
      activeGeometry.setDrawRange(0, count * 2);
      /*
       * Only a real star can be framed; a layer anchor is not a pick target.
       * Closing a record hands the camera back to whatever the layer pills were
       * pointing at, or all the way home.
       */
      if (id && meshes.has(id)) {
        framing = { id, t: 0 };
        tween = null;
        returnHome = null;
      } else {
        framing = null;
        returnHome = null;
        if (focusAnchorId) {
          const to = homeDistance * 0.74;
          const from = camera.position.distanceTo(controls.target);
          if (introT >= 1 && Math.abs(from - to) > 0.05) {
            tween = { from, to, t: 0 };
          }
        } else if (
          introT >= 1 &&
          (camera.position.distanceTo(home) > 0.25 || controls.target.lengthSq() > 0.04)
        ) {
          // A tap's pointer-down already dropped the framing move, so closing
          // has to start the return itself. The opening approach is left alone.
          tween = null;
          returnHome = {
            t: 0,
            fromCamera: camera.position.clone(),
            fromTarget: controls.target.clone(),
          };
        }
      }
    };
    applySelectionRef.current(selectedId);

    /* --------------------------------------------------------------- focus */
    /**
     * A layer pill lights its own cluster and dims the rest of the ramp, then
     * eases the camera in on the anchor. The graph keeps orbiting; only the aim
     * and the brightness change, so the move is never a jump.
     */
    const clusterOf = new Map<string, string | undefined>();
    nodes.forEach((n) => clusterOf.set(n.id, n.cluster));

    let focusCluster: string | null = null;

    const paint = () => {
      const attribute = linkGeometry.getAttribute("color") as THREE.BufferAttribute;
      links.forEach((l, i) => {
        const lit = !focusCluster || l.cluster === focusCluster;
        const k = lit ? 1 : 0.16;
        attribute.setXYZ(i * 2, baseLinkColor[i * 6] * k, baseLinkColor[i * 6 + 1] * k, baseLinkColor[i * 6 + 2] * k);
        attribute.setXYZ(i * 2 + 1, baseLinkColor[i * 6 + 3] * k, baseLinkColor[i * 6 + 4] * k, baseLinkColor[i * 6 + 5] * k);
      });
      attribute.needsUpdate = true;

      const lit = (id: string) => !focusCluster || clusterOf.get(id) === focusCluster;
      nodeMaterials.forEach((material, id) => {
        material.emissiveIntensity = lit(id) ? 0.75 : 0.12;
      });
      haloMaterials.forEach((material, id) => {
        material.opacity = lit(id) ? 0.62 : 0.1;
      });
      anchorMaterials.forEach((material, id) => {
        material.opacity = clusterOf.get(id) === focusCluster ? 0.85 : 0.14;
      });
    };

    applyFocusRef.current = (cluster: string | null) => {
      focusCluster = cluster;
      focusAnchorId = cluster ? anchorSceneId(cluster) : null;
      paint();
      // A pill points at a layer; it outranks a star the reader already opened.
      framing = null;
      tween = {
        from: camera.position.distanceTo(controls.target),
        to: cluster ? homeDistance * 0.74 : homeDistance,
        t: 0,
      };
    };
    paint();

    /* ------------------------------------------------------------- picking */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let downTime = 0;
    let downType: PointerEvent["pointerType"] = "mouse";
    /** Until when the sky's own drift stays out of the way of the hand. */
    let gestureUntil = 0;

    const canvas = renderer.domElement;

    const toNdc = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    /**
     * Where a gesture starts decides who gets it. The middle of the canvas is the
     * sky's. A band round the edge stays the page's, so a reader on a phone can
     * always swipe away from a full-bleed sky, and a wheel near an edge scrolls
     * the article instead of zooming the graph.
     */
    const inGestureZone = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const bandX = Math.max(rect.width * GESTURE_EDGE, GESTURE_EDGE_PX);
      const bandY = Math.max(rect.height * GESTURE_EDGE, GESTURE_EDGE_PX);
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return (
        x > bandX && x < rect.width - bandX && y > bandY && y < rect.height - bandY
      );
    };

    /**
     * Registered on the host in the capture phase, so it answers before
     * OrbitControls sees the pointer at all. Inside the zone the sky takes the
     * gesture; outside it, the controls go quiet and the page keeps scrolling.
     * A tap is still a tap everywhere, because the hit test below never asks
     * which zone the finger landed in.
     */
    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
      downTime = performance.now();
      downType = event.pointerType;

      const inside = inGestureZone(event.clientX, event.clientY);
      controls.enabled = inside;
      canvas.style.touchAction = inside ? "none" : "pan-y";
      if (inside) canvas.style.cursor = "grabbing";

      // The hand owns the sky now: the drift waits and every tween lets go.
      gestureUntil = performance.now() + AUTO_ROTATE_PAUSE_MS;
      tween = null;
      framing = null;
      returnHome = null;
      introT = 1;
    };

    const releaseGesture = () => {
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
    };

    /*
     * A finger lands slower and wider than a cursor, so a touch gets a larger
     * travel allowance and more time before the gesture counts as a rotate.
     */
    const onPointerUp = (event: PointerEvent) => {
      releaseGesture();
      const touch = event.pointerType === "touch" || downType === "touch";
      const slop = touch ? TAP_TOUCH_PX : TAP_DESKTOP_PX;
      const patience = touch ? TAP_TOUCH_MS : TAP_DESKTOP_MS;
      if (
        Math.hypot(event.clientX - downX, event.clientY - downY) > slop ||
        performance.now() - downTime > patience
      ) {
        return;
      }
      toNdc(event.clientX, event.clientY);
      raycaster.setFromCamera(pointer, camera);
      const found = raycaster.intersectObjects(clickable, false);
      if (found.length > 0) {
        selectRef.current?.(found[0].object.userData.id as string);
      } else {
        // Empty sky closes the open record and sends the camera home.
        selectRef.current?.(null);
      }
    };

    /**
     * The wheel is settled before OrbitControls ever sees it. Near an edge the
     * page keeps the scroll, and stopping propagation here is what makes the
     * graph let go of it.
     */
    const onWheel = (event: WheelEvent) => {
      if (!inGestureZone(event.clientX, event.clientY)) {
        event.stopImmediatePropagation();
      }
    };

    let lastHover = 0;
    const onPointerMove = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      // Outside the zone there is nothing to point at, so do not pretend there is.
      if (!inGestureZone(event.clientX, event.clientY)) {
        canvas.style.cursor = "default";
        return;
      }
      toNdc(event.clientX, event.clientY);
      raycaster.setFromCamera(pointer, camera);
      canvas.style.cursor =
        raycaster.intersectObjects(clickable, false).length > 0 ? "pointer" : "grab";
    };

    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("wheel", onWheel, { capture: true, passive: true });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", releaseGesture);
    canvas.addEventListener("pointermove", onPointerMove);

    /*
     * Chromium latches touch-action from the style committed before a gesture
     * begins, so raising it to none in onPointerDown lands too late to stop
     * the page scrolling under that same drag. Decide by where the finger
     * landed: a gesture that started inside the zone belongs to the sky, and
     * the page must not also scroll.
     */
    const onTouchMove = (event: TouchEvent) => {
      if (downType === "touch" && inGestureZone(downX, downY)) {
        event.preventDefault();
      }
    };
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    resetRef.current = () => {
      tween = null;
      returnHome = null;
      introT = 1;
      applyFocusRef.current?.(null);
      controls.target.set(0, 0, 0);
      camera.position.copy(home);
      controls.update();
    };

    /* -------------------------------------------------------------- labels */
    const projected = new THREE.Vector3();
    const live = new THREE.Vector3();
    const targetWorld = new THREE.Vector3();

    const placeLabel = (el: HTMLElement, world: THREE.Vector3, lift: number) => {
      const rect = canvas.getBoundingClientRect();
      projected.copy(world).project(camera);
      // Behind the camera, or past an edge: fade out rather than hang over.
      const margin = 46 / Math.max(rect.width, 1);
      const visible =
        projected.z < 1 &&
        projected.x > -1 - margin &&
        projected.x < 1 + margin &&
        projected.y > -1 - margin &&
        projected.y < 1 + margin;
      el.style.opacity = visible ? "1" : "0";
      el.style.transform = `translate(-50%,-50%) translate(${
        ((projected.x + 1) / 2) * rect.width
      }px,${((1 - projected.y) / 2) * rect.height - lift}px)`;
    };

    const placeLabels = () => {
      graph.updateWorldMatrix(true, false);
      core.updateWorldMatrix(true, false);
      labelRefs.current.forEach((el, id) => {
        // A label rides with the star it names, not with where it was placed.
        const base = liveEnd(id);
        if (!base) return;
        live.copy(base).applyMatrix4(graph.matrixWorld);
        placeLabel(el, live, 26);
      });
      const coreLabel = coreLabelRef.current;
      if (coreLabel && drawHotloader) {
        // The hotloader keeps its own tilt, so its label rides with `core`.
        // It hangs clear of the photon ring, which is wide enough to reach 60px
        // on screen at the hero's home distance.
        live.set(0, 0, 0).applyMatrix4(core.matrixWorld);
        placeLabel(coreLabel, live, -64);
      }
    };

    /* ---------------------------------------------------------- lensing pass */
    /*
     * The bend is not painted onto a plane; it is a screen-space pass over the frame
     * the scene just rendered, so the starfield behind the hole is displaced and split
     * by wavelength. `EffectComposer` owns two half-float buffers, which is every
     * target this needs.
     *
     * It is built on the first frame that actually has a hole on screen. A sky with no
     * hotloader never allocates them and never runs the pass, so its frames go straight
     * to the canvas exactly as they did before.
     */
    let composer: EffectComposer | null = null;
    let lensPass: ShaderPass | null = null;

    const ensureComposer = () => {
      if (composer) return composer;
      const built = new EffectComposer(renderer);
      built.addPass(new RenderPass(scene, camera));
      const pass = new ShaderPass(createLensingShader());
      /*
       * A full-screen quad that replaces what it draws over. That is what three's own
       * copy pass does, and it is what this chain needs: the default material would
       * blend the frame onto the destination buffer's old contents and stack the image
       * on itself every pass.
       */
      pass.material.blending = THREE.NoBlending;
      built.addPass(pass);
      const output = new OutputPass();
      output.material.blending = THREE.NoBlending;
      built.addPass(output);
      composer = built;
      lensPass = pass;
      return built;
    };

    /** The hole's centre and radius on this frame's canvas, in the pass's units. */
    const lensPoint = new THREE.Vector3();
    let lensActive = 0;
    /** Reported back to the readout: the shadow and the pull, in CSS pixels. */
    let lensShadowPx = 0;
    let lensBendPx = 0;

    /**
     * Where the hole is on this frame's canvas, and how big its shadow is there.
     *
     * `uShadow` has to be the on-screen radius, and the camera orbits, so it comes from
     * the distance to the hole each frame instead of a fixed number. A perspective
     * camera of vertical field `fov` sees a half-height of `distance * tan(fov/2)` at
     * that distance, and the pass measures its radius in half-heights.
     */
    const aimLens = () => {
      core.updateWorldMatrix(true, false);
      lensPoint.set(0, 0, 0).applyMatrix4(core.matrixWorld);
      const distance = camera.position.distanceTo(lensPoint);
      lensPoint.project(camera);
      /*
       * Behind the camera, or so far off the edge that the ring it would bend is not on
       * screen. The pass goes quiet rather than bending an empty corner.
       */
      if (lensPoint.z > 1 || Math.abs(lensPoint.x) > 1.45 || Math.abs(lensPoint.y) > 1.45) {
        return null;
      }
      const shape = lensGeometry(SHADOW_RADIUS, distance, camera.fov, camera.aspect);
      return {
        x: (lensPoint.x + 1) / 2,
        /*
         * Same axis as NDC. The pass samples a full-screen triangle whose vUv
         * has y = 0 at the bottom of the canvas. Flipping y draws the shadow
         * on the opposite side of the screen from the mesh, so a phone — where
         * the hole sits low — shows a second hole up by the headline.
         */
        y: (lensPoint.y + 1) / 2,
        ...shape,
        shadowPx: shape.shadow * viewHeight,
        distance,
      };
    };

    /* ---------------------------------------------------------------- loop */
    const clock = new THREE.Clock();
    /*
     * `?fps` in the address bar prints a running reading into the corner of this sky:
     * the frame rate, the hole's layer count, whether the lens pass is live, and the
     * shadow's size on screen. It exists so the cost of the render path is measured at
     * a real viewport instead of argued about. With the flag absent nothing here is
     * constructed and the loop never calls it.
     */
    const readout = (): SkyReadout => ({
      hotloader: blackHole !== null,
      layers: blackHole ? blackHole.layerNames : [],
      lensActive,
      shadowPx: lensShadowPx,
      bendPx: lensBendPx,
    });
    const meter = measurementMode() ? new FrameMeter(meterRef.current, readout) : null;
    /*
     * `?fps&nolens` renders the same hole with the lensing pass bypassed, which is the
     * other half of the cost measurement. Without the flag this is false and the pass
     * always runs where there is a hole.
     */
    const bypassLens = lensBypassRequested();
    /**
     * The lens probe fires once, after the scene has had a moment to build its render
     * targets and settle its camera. Without `?fps` there is no meter, so it never runs.
     */
    const PROBE_AFTER_SECONDS = 2.4;
    let probePending = false;
    const origin = new THREE.Vector3();
    const aim = new THREE.Vector3();
    // Scratch vectors for framing and the live link ends, reused every frame.
    const framePoint = new THREE.Vector3();
    const frameCentre = new THREE.Vector3();
    const frameDir = new THREE.Vector3();
    const frameCamera = new THREE.Vector3();
    let frame = 0;
    let baseY = 0;
    let parallaxOn = false;
    let lastElapsed = 0;

    /** A star's live position, or its anchor if the point never moves. */
    const liveEnd = (id: string): THREE.Vector3 | undefined =>
      meshes.get(id)?.position ?? rest.get(id);

    const applyViewport = () => {
      const w = host.clientWidth || 1;
      baseY = sinkOnNarrow && w < 640 ? -3.1 : 0;
      /*
       * Parallax is a desktop depth cue. On a phone the sky sliding under
       * the finger as the page scrolls is what makes the map impossible to
       * steer, so the effect is off below the desktop breakpoint.
       */
      parallaxOn = parallax && w >= 1024;
      graph.position.y = baseY;
      core.position.y = baseY;
    };
    applyViewport();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const elapsed = clock.getElapsedTime();
      const delta = Math.min(0.05, elapsed - lastElapsed);
      lastElapsed = elapsed;
      const now = performance.now();
      // Reduced motion keeps a very slow drift instead of stopping.
      const drift = reduced ? 0.15 : 1;

      // Arm the one-shot lens probe once the scene has settled.
      if (meter && !probePending && elapsed >= PROBE_AFTER_SECONDS) {
        probePending = true;
      }

      /*
       * The drift waits for the hand. It stops for a gesture and a beat after it,
       * and for as long as a star is being framed, then eases back in over a ramp
       * so the sky never snaps into motion under a reader who just let go.
       */
      if (introT < 1 || framing || returnHome || now < gestureUntil) {
        controls.autoRotate = false;
      } else {
        controls.autoRotate = true;
        controls.autoRotateSpeed =
          driftSpeed * Math.min(1, (now - gestureUntil) / AUTO_ROTATE_RAMP_MS);
      }

      // The opening approach: a swing inward, not a straight line to home.
      if (introT < 1) {
        introT = Math.min(1, introT + delta / INTRO_SECONDS);
        const eased = 1 - Math.pow(1 - introT, 3);
        introSpherical.radius =
          homeSpherical.radius *
          (INTRO_START_SCALE - (INTRO_START_SCALE - 1) * eased);
        introSpherical.theta = homeSpherical.theta + INTRO_ARC_RADIANS * (1 - eased);
        camera.position.setFromSpherical(introSpherical);
      }

      // The graph orbits the core; the shells drift at their own rates.
      graph.rotation.y = elapsed * 0.02 * drift;
      farShell.rotation.y = -elapsed * 0.006 * drift;
      nearShell.rotation.y = elapsed * 0.012 * drift;
      farShell.rotation.x = Math.sin(elapsed * 0.02) * 0.03 * drift;

      if (parallaxOn) {
        const sy = window.scrollY;
        farShell.position.y = sy * 0.012;
        nearShell.position.y = sy * 0.026;
        graph.position.y = baseY + sy * 0.042;
        // The hotloader rides with the graph, so the two never separate.
        core.position.y = graph.position.y;
      }

      /*
       * The hole runs on the same scaled delta the rest of the sky does, so reduced
       * motion slows it down instead of freezing it, and its pulse keeps the amplitude
       * the painted hotloader had.
       */
      if (blackHole) blackHole.update(delta * (reduced ? 0.35 : 1));

      /*
       * Every star moves on its own clock, on all three axes, at its own speed.
       * Nothing here is shared between stars, so the sky shivers instead of
       * bobbing in step. The links follow their endpoints below.
       */
      const attribute = linkGeometry.getAttribute("position") as THREE.BufferAttribute;
      meshes.forEach((mesh, id) => {
        const base = rest.get(id);
        const m = motion.get(id);
        if (base && m) {
          mesh.position.set(
            base.x + Math.sin(elapsed * m.sx + m.px) * m.ax * drift,
            base.y + Math.sin(elapsed * m.sy + m.py) * m.ay * drift,
            base.z + Math.sin(elapsed * m.sz + m.pz) * m.az * drift,
          );
        }
        const size = sizes.get(id) ?? 0.2;
        const pulse = 1 + Math.sin(elapsed * (m?.tw ?? 0.7) + (m?.pz ?? 0)) * 0.06;
        const boost = id === activeId ? 1.8 : 1;
        mesh.scale.setScalar(size * pulse * boost);
        const halo = halos.get(id);
        if (halo) {
          halo.position.copy(mesh.position);
          halo.scale.setScalar(size * 5.5 * pulse * boost);
        }
        // The invisible target rides with the star, so a tap lands where it moved.
        const target = pickTargets.get(id);
        if (target) {
          target.position.copy(mesh.position);
          target.getWorldPosition(targetWorld);
          const distance = camera.position.distanceTo(targetWorld);
          target.scale.setScalar(
            Math.max(size * HIT_RADIUS, distance * MIN_HIT_ANGULAR),
          );
        }
      });

      /*
       * Framing. A picked star is tracked as the graph turns, and the camera
       * swings out along the line from the middle of the sky through that star,
       * so the star faces the reader with the hotloader behind it. A layer pill
       * frames its anchor instead. A drag or a reset takes over immediately.
       */
      graph.updateWorldMatrix(true, false);
      core.updateWorldMatrix(true, false);

      if (returnHome) {
        returnHome.t = Math.min(1, returnHome.t + delta / 0.95);
        const eased = 1 - Math.pow(1 - returnHome.t, 3);
        controls.target.lerpVectors(returnHome.fromTarget, origin, eased);
        camera.position.lerpVectors(returnHome.fromCamera, home, eased);
        if (returnHome.t >= 1) returnHome = null;
      } else if (framing) {
        const mesh = meshes.get(framing.id);
        if (mesh) {
          framing.t = Math.min(1, framing.t + delta / 1.1);
          const eased = 1 - Math.pow(1 - framing.t, 3);
          mesh.getWorldPosition(framePoint);
          frameCentre.set(0, 0, 0).applyMatrix4(core.matrixWorld);
          frameDir.copy(framePoint).sub(frameCentre);
          // A star sitting on the axis has no side to face; keep the bearing.
          if (frameDir.lengthSq() < 1e-4) {
            frameDir.copy(camera.position).sub(controls.target);
          }
          frameDir.normalize();
          frameCamera
            .copy(framePoint)
            .addScaledVector(
              frameDir,
              Math.max(
                controls.minDistance,
                homeDistance * FRAME_DISTANCE_FACTOR,
              ),
            );
          controls.target.lerp(framePoint, 0.12);
          camera.position.lerp(frameCamera, 0.05 + 0.09 * eased);
        }
      } else if (focusAnchorId) {
        const anchor = rest.get(focusAnchorId);
        if (anchor) {
          aim.copy(anchor).applyMatrix4(graph.matrixWorld);
          controls.target.lerp(aim, 0.05);
        }
      } else {
        controls.target.lerp(origin, 0.05);
      }

      if (!framing && !returnHome && tween && tween.t < 1) {
        tween.t = Math.min(1, tween.t + delta / 0.9);
        const eased = 1 - Math.pow(1 - tween.t, 3);
        const want = Math.max(
          controls.minDistance,
          tween.from + (tween.to - tween.from) * eased,
        );
        frameDir.copy(camera.position).sub(controls.target).setLength(want);
        camera.position.copy(controls.target).add(frameDir);
        if (tween.t >= 1) tween = null;
      }

      if (activeId) {
        const activeAttribute = activeGeometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        let count = 0;
        links.forEach((l) => {
          if (l.fromId !== activeId && l.toId !== activeId) return;
          const a = liveEnd(l.fromId);
          const b = liveEnd(l.toId);
          if (!a || !b) return;
          activeAttribute.setXYZ(count * 2, a.x, a.y, a.z);
          activeAttribute.setXYZ(count * 2 + 1, b.x, b.y, b.z);
          count += 1;
        });
        activeAttribute.needsUpdate = true;
      } else {
        activeGeometry.setDrawRange(0, 0);
      }

      // Every link is redrawn from where its ends actually are, on all three axes.
      for (let i = 0; i < links.length; i += 1) {
        const l = links[i];
        const a = liveEnd(l.fromId);
        const b = liveEnd(l.toId);
        if (!a || !b) continue;
        attribute.setXYZ(i * 2, a.x, a.y, a.z);
        attribute.setXYZ(i * 2 + 1, b.x, b.y, b.z);
      }
      attribute.needsUpdate = true;

      controls.update();

      /*
       * Where the hole is this frame. The camera orbits and the graph turns under it, so
       * the pass is aimed every frame rather than left at the screen centre, and it goes
       * quiet the moment there is no hole to bend light around.
       */
      const hole = blackHole && !bypassLens ? aimLens() : null;
      if (hole) {
        ensureComposer();
        const uniforms = lensPass!.material.uniforms;
        (uniforms.uCenter.value as THREE.Vector2).set(hole.x, hole.y);
        uniforms.uAspect.value = hole.aspect;
        uniforms.uShadow.value = hole.shadow;
        uniforms.uOuter.value = hole.outer;
        uniforms.uStrength.value = hole.strength;
        uniforms.uActive.value = 1;
        lensActive = 1;
        lensShadowPx = hole.shadowPx;
        // How hard the band just outside the shadow is pulled, in CSS pixels.
        lensBendPx = hole.strength * viewHeight;
        composer!.render(delta);
      } else {
        if (lensPass) lensPass.material.uniforms.uActive.value = 0;
        lensActive = 0;
        lensShadowPx = 0;
        lensBendPx = 0;
        renderer.render(scene, camera);
      }

      placeLabels();

      /*
       * The bend, measured rather than asserted. Under `?fps`, once the scene has
       * settled, a band just outside the shadow and a band far away are read back twice
       * from the canvas: once with the pass live, once with it forced off for a frame.
       * The difference between the two is the pass, and the red-minus-blue gap inside a
       * band is the channel split. The bent frame is rendered again afterwards, so the
       * probe leaves the screen as it found it. This runs only under the flag, and only
       * for one frame, because it costs three extra full renders.
       */
      if (meter && probePending && hole && lensPass) {
        probePending = false;
        const ratio = renderer.getPixelRatio();
        const bufferWidth = renderer.domElement.width;
        const bufferHeight = renderer.domElement.height;
        const cx = hole.x * bufferWidth;
        // uCenter and readPixels are both bottom-origin.
        const cy = hole.y * bufferHeight;
        const shadowPx = hole.shadowPx * ratio;
        const bandW = Math.round(Math.min(28, bufferWidth * 0.06));
        const bandH = 6;
        /*
         * Straight up from the centre. A phone canvas is tall and narrow, so a band to
         * the side of the hole can easily fall past where the bend reaches and read as
         * no change at all; the vertical axis has room in both orientations.
         */
        const nearY = cy - shadowPx * 1.35;
        const farY = cy - shadowPx * 9;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const uniforms = lensPass.material.uniforms;
        const onNear = readBand(gl, bufferWidth, bufferHeight, cx, nearY, bandW, bandH);
        const onFar = readBand(gl, bufferWidth, bufferHeight, cx, farY, bandW, bandH);
        uniforms.uActive.value = 0;
        composer!.render(delta);
        const offNear = readBand(gl, bufferWidth, bufferHeight, cx, nearY, bandW, bandH);
        const offFar = readBand(gl, bufferWidth, bufferHeight, cx, farY, bandW, bandH);
        uniforms.uActive.value = 1;
        composer!.render(delta);
        /*
         * Alpha, read from the bottom-right corner of the canvas where no geometry is
         * drawn. The page's background and the hero scrim show through the canvas, so a
         * composer that flattened the frame to opaque would report 1.000 here and black
         * all of that out. Anything well under one is the scrim still reading.
         */
        const corner = readBand(
          gl,
          bufferWidth,
          bufferHeight,
          bufferWidth - bandW - 2,
          bufferHeight - bandH - 2,
          bandW,
          bandH,
        );
        meter.setExtra(
          `bend near ${(bandDelta(onNear, offNear) * 100).toFixed(2)}% ` +
            `far ${(bandDelta(onFar, offFar) * 100).toFixed(2)}% ` +
            `chroma near ${bandChroma(onNear).toFixed(3)} far ${bandChroma(onFar).toFixed(3)} ` +
            `alpha ${bandAlpha(corner).toFixed(3)}`,
        );
        /*
         * The probe costs three extra full renders and a synchronous readback, so the
         * frames it ran in are not a fair sample of ordinary rendering. Drop that window
         * and let the next reading come from clean frames.
         */
        meter.discard();
      }

      meter?.sample(now);
    };

    const observer = new ResizeObserver(() => {
      viewWidth = host.clientWidth || 1;
      viewHeight = host.clientHeight || 1;
      camera.aspect = viewWidth / viewHeight;
      camera.updateProjectionMatrix();
      const ratio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(ratio);
      renderer.setSize(viewWidth, viewHeight);
      /*
       * The composer owns its own pixel ratio, taken from the renderer when it was
       * built. A window moving between monitors changes the renderer's, so both have to
       * be told or the pass would sample a buffer of a different size than the frame.
       */
      if (composer) {
        composer.setPixelRatio(ratio);
        composer.setSize(viewWidth, viewHeight);
      }
      applyViewport();
    });
    observer.observe(host);
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("wheel", onWheel, { capture: true });
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", releaseGesture);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("touchmove", onTouchMove);
      applySelectionRef.current = null;
      applyFocusRef.current = null;
      resetRef.current = null;
      blackHole?.dispose();
      lensPass?.dispose();
      composer?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      glow.dispose();
      ring.dispose();
      renderer.dispose();
      if (canvas.parentNode === canvasHost) canvasHost.removeChild(canvas);
      labelRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, homeDistance, homeElevation, hotloader, sinkOnNarrow, parallax, intro]);

  useEffect(() => {
    applySelectionRef.current?.(selectedId);
  }, [selectedId]);

  useEffect(() => {
    applyFocusRef.current?.(focus);
  }, [focus]);

  useEffect(() => {
    if (resetSignal > 0) resetRef.current?.();
  }, [resetSignal]);

  return (
    <div ref={hostRef} data-sky="" className="canvas-shell relative h-full w-full">
      <div ref={canvasHostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        {measurementMode() && (
          <div
            ref={meterRef}
            aria-hidden="true"
            className="absolute right-1 top-1 max-w-[46ch] font-mono text-[0.5625rem] leading-tight tabular-nums text-[hsl(var(--whisper)/0.7)]"
          />
        )}
        {labeledNodes.map((n) => (
          <span
            key={n.id}
            ref={(el) => {
              if (el) labelRefs.current.set(n.id, el);
              else labelRefs.current.delete(n.id);
            }}
            className="node-label"
            data-kind={n.kind}
            data-selected={n.id === selectedId}
          >
            {n.label ?? n.id}
          </span>
        ))}
        {hotloader && !holeBypassRequested() && hotloaderLabel && (
          <div ref={coreLabelRef} className="node-label" data-kind="core">
            <span className="block text-[0.6875rem] font-semibold tracking-[0.2em] text-[hsl(var(--twine-step))]">
              {hotloaderLabel}
            </span>
            {hotloaderNote && (
              <span className="mt-1 block text-[0.5625rem] tracking-[0.06em] text-[hsl(var(--whisper)/0.72)]">
                {hotloaderNote}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="sr-only">{ariaLabel}</p>
      <p className="sr-only">{fallbackText}</p>
    </div>
  );
}
