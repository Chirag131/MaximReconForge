import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";

function App() {
  return (
    <>
      <video
        className="fixed inset-0 -z-[5] h-full w-full object-cover brightness-[0.24] contrast-125 saturate-[2] hue-rotate-[225deg] sepia-[0.35] blur-[0.8px]"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      <div className="relative z-[2] min-h-screen">
        <Navbar />
        <Hero />
        <Features />
      </div>
    </>
  );
}

export default App;