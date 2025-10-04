import { useEffect, useRef } from "react";

interface VoiceVisualizationProps {
  isRecording: boolean;
  audioStream: MediaStream | null;
}

export const VoiceVisualization = ({ isRecording, audioStream }: VoiceVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const colorsRef = useRef<{ primary: string; accent: string; background: string }>({
    primary: '',
    accent: '',
    background: ''
  });

  useEffect(() => {
    if (!canvasRef.current || !audioStream || !isRecording) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get computed CSS colors
    const styles = getComputedStyle(document.documentElement);
    const primaryHsl = styles.getPropertyValue('--primary').trim();
    const accentHsl = styles.getPropertyValue('--accent').trim();
    const backgroundHsl = styles.getPropertyValue('--background').trim();
    
    colorsRef.current = {
      primary: `hsl(${primaryHsl})`,
      accent: `hsl(${accentHsl})`,
      background: `hsl(${backgroundHsl})`
    };

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);
    
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let rotation = 0;

    const draw = () => {
      if (!ctx || !analyserRef.current) return;

      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = colorsRef.current.background;
      ctx.fillRect(0, 0, width, height);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const normalizedVolume = average / 255;

      // 3D sphere effect
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 80;
      const maxRadius = 150;
      const radius = baseRadius + (maxRadius - baseRadius) * normalizedVolume;

      rotation += 0.02;

      // Draw multiple layers for 3D effect
      for (let layer = 0; layer < 3; layer++) {
        const layerRadius = radius - layer * 20;
        const opacity = 1 - layer * 0.3;

        // Create gradient
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          layerRadius
        );

        const primaryRgba = colorsRef.current.primary.replace('hsl', 'hsla').replace(')', `, ${opacity})`);
        const accentRgba = colorsRef.current.accent.replace('hsl', 'hsla').replace(')', `, ${opacity * 0.7})`);
        const primaryTransparent = colorsRef.current.primary.replace('hsl', 'hsla').replace(')', ', 0)');
        
        gradient.addColorStop(0, primaryRgba);
        gradient.addColorStop(0.5, accentRgba);
        gradient.addColorStop(1, primaryTransparent);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, layerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Add particles around the sphere
        const particles = 12;
        for (let i = 0; i < particles; i++) {
          const angle = (i / particles) * Math.PI * 2 + rotation;
          const particleRadius = layerRadius + 30;
          const px = centerX + Math.cos(angle) * particleRadius;
          const py = centerY + Math.sin(angle) * particleRadius;
          const size = 4 + normalizedVolume * 8;

          const accentRgba = colorsRef.current.accent.replace('hsl', 'hsla').replace(')', `, ${opacity})`);
          ctx.fillStyle = accentRgba;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Add frequency bars in circular pattern
      const bars = 32;
      const barMaxHeight = 50;
      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 + rotation;
        const dataIndex = Math.floor((i / bars) * bufferLength);
        const barHeight = (dataArray[dataIndex] / 255) * barMaxHeight;

        const innerRadius = radius + 20;
        const outerRadius = innerRadius + barHeight;

        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * outerRadius;
        const y2 = centerY + Math.sin(angle) * outerRadius;

        const primaryRgba = colorsRef.current.primary.replace('hsl', 'hsla').replace(')', ', 0.8)');
        ctx.strokeStyle = primaryRgba;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [isRecording, audioStream]);

  return (
    <div className="flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="rounded-lg"
      />
    </div>
  );
};
