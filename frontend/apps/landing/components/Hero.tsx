"use client";

// The animated hero — a working proof of the full landing stack (Lenis smooth scroll,
// GSAP ScrollTrigger pinning/scrubbing, react-three-fiber 3D), ready to be replaced by the real
// Uber-calibre design. Everything here is deliberately minimal but real: swap the placeholder
// torus for a product 3D model (or a Spline scene) and the copy for the marketing narrative.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import type { Mesh } from "three";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function SpinningKnot() {
  const mesh = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.x += delta * 0.25;
    mesh.current.rotation.y += delta * 0.35;
  });
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={mesh}>
        <torusKnotGeometry args={[1, 0.32, 220, 32]} />
        <meshStandardMaterial color="#1d4ed8" metalness={0.85} roughness={0.15} />
      </mesh>
    </Float>
  );
}

export default function Hero() {
  const root = useRef<HTMLDivElement>(null);

  // Lenis drives scrolling; ScrollTrigger listens to it — the standard pairing on award sites.
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  useGSAP(
    () => {
      // Headline entrance.
      gsap.from("[data-hero-line]", {
        yPercent: 120,
        opacity: 0,
        stagger: 0.12,
        duration: 1,
        ease: "power4.out",
      });
      // Pinned scroll story: the second panel's text scrubs in while the hero holds.
      gsap.to("[data-story]", {
        scrollTrigger: {
          trigger: "[data-story-wrap]",
          start: "top top",
          end: "+=120%",
          scrub: true,
          pin: true,
        },
        opacity: 1,
        y: 0,
        ease: "none",
      });
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      <section className="relative flex h-svh flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[4, 4, 4]} intensity={1.2} />
            <SpinningKnot />
            <Environment preset="city" />
          </Canvas>
        </div>
        <div className="pointer-events-none relative z-10 text-center">
          <p data-hero-line className="mb-3 text-sm uppercase tracking-[0.3em] text-secondary">
            SETHU-CARE
          </p>
          <h1 data-hero-line className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
            Home services, dispatched in under a minute.
          </h1>
          <p data-hero-line className="mt-5 text-lg text-white/70">
            Trusted technicians. Automatic assignment. Verified completion.
          </p>
        </div>
        <div className="absolute bottom-8 z-10 animate-bounce text-white/50">scroll</div>
      </section>

      <section data-story-wrap className="flex h-svh items-center justify-center">
        <div data-story className="max-w-2xl translate-y-16 px-6 text-center opacity-0">
          <h2 className="text-4xl font-bold text-primary md:text-5xl">Book. Assigned. Done.</h2>
          <p className="mt-6 text-lg text-white/70">
            No slots, no waiting rooms — the nearest certified technician is assigned to you
            automatically, and every job is verified start-to-finish with dual OTP codes.
          </p>
        </div>
      </section>
    </div>
  );
}
