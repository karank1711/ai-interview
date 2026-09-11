import BrainNeuralAnimation from './BrainNeuralAnimation';
import './sidebarMotion.css';

export default function AnimatedBrain({
  src = '/images/brain.png',
  className = 'h-11 w-11',
  particleCount = 8,
  speed = 1,
  glowIntensity = 0.55,
  playing = true,
}) {
  return (
    <div className={`brain-glow relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt=""
        className="relative z-0 h-full w-full object-contain mix-blend-screen"
        draggable="false"
      />
      <BrainNeuralAnimation
        src={src}
        particleCount={particleCount}
        speed={speed}
        glowIntensity={glowIntensity}
        playing={playing}
      />
    </div>
  );
}
