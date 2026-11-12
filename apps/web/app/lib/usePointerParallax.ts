import { useEffect, type RefObject } from "react";

export type PointerParallaxOptions = {
  /** Максимальное смещение по X в нормализованных единицах (-1..1 → 0..1). */
  strengthX?: number;
  /** Максимальное смещение по Y. */
  strengthY?: number;
  /** Коэффициент сглаживания (0.05 — вяло, 0.2 — отзывчиво). */
  damping?: number;
};

/**
 * Деликатный параллакс по указателю (мышь или палец).
 *
 * Принципы:
 * - значения пишутся в CSS-переменные `--hero-px` / `--hero-py` прямо в DOM,
 *   без `useState` → компонент не перерисовывается;
 * - один rAF-цикл, который останавливается, когда движение завершено;
 * - слушатели пассивные (`passive: true`) → прокрутка не блокируется;
 * - при `prefers-reduced-motion: reduce` эффект не подключается вообще;
 * - все слушатели и кадр снимаются в очистке эффекта.
 */
export function usePointerParallax<T extends HTMLElement>(
  targetRef: RefObject<T | null>,
  options: PointerParallaxOptions = {},
): void {
  const strengthX = options.strengthX ?? 1;
  const strengthY = options.strengthY ?? 1;
  const damping = options.damping ?? 0.12;

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frameId = 0;
    let isRunning = false;

    const clamp = (value: number): number => Math.min(1, Math.max(-1, value));

    const render = (): void => {
      currentX += (targetX - currentX) * damping;
      currentY += (targetY - currentY) * damping;

      element.style.setProperty("--hero-px", currentX.toFixed(4));
      element.style.setProperty("--hero-py", currentY.toFixed(4));

      const settled =
        Math.abs(targetX - currentX) < 0.0005 &&
        Math.abs(targetY - currentY) < 0.0005;

      if (settled) {
        isRunning = false;
        frameId = 0;
        return;
      }

      frameId = window.requestAnimationFrame(render);
    };

    const schedule = (): void => {
      if (isRunning) return;
      isRunning = true;
      frameId = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const relativeX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const relativeY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      targetX = clamp(relativeX) * strengthX;
      targetY = clamp(relativeY) * strengthY;
      schedule();
    };

    const resetToCenter = (): void => {
      targetX = 0;
      targetY = 0;
      schedule();
    };

    const handleMotionChange = (): void => {
      if (motionQuery.matches) resetToCenter();
    };

    element.addEventListener("pointermove", handlePointerMove, { passive: true });
    element.addEventListener("pointerleave", resetToCenter, { passive: true });
    element.addEventListener("pointercancel", resetToCenter, { passive: true });
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", resetToCenter);
      element.removeEventListener("pointercancel", resetToCenter);
      motionQuery.removeEventListener("change", handleMotionChange);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
      element.style.removeProperty("--hero-px");
      element.style.removeProperty("--hero-py");
    };
  }, [targetRef, strengthX, strengthY, damping]);
}
