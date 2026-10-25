"use client";

import React, { useRef, useEffect } from "react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";

interface CanvasVisualizerProps {
  width?: number;
  height?: number;
  barColor?: string;
}

export const CanvasVisualizer: React.FC<CanvasVisualizerProps> = ({
  width = 160,
  height = 36,
  barColor = "#00f0ff",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isPlaying, getFrequencyData } = useAudioPlayer();
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const freqData = getFrequencyData();
      const numBars = 24;
      const barWidth = Math.floor(width / numBars) - 2;

      for (let i = 0; i < numBars; i++) {
        let value = isPlaying ? freqData[i * 2] || 0 : 8 + Math.sin(Date.now() * 0.003 + i) * 4;
        const percent = Math.min(1.0, value / 255.0);
        const barHeight = Math.max(3, percent * height);
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, "#00f0ff");
        grad.addColorStop(0.7, "#a855f7");
        grad.addColorStop(1, "#ec4899");

        ctx.fillStyle = isPlaying ? grad : "#2c3245";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded bg-studio-950/60 border border-studio-700/40"
    />
  );
};
