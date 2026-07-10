import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";

function App() {
  return (
    <>
      <video className="bg-video" autoPlay muted loop playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      <div className="page">
        <Navbar />
        <Hero />
        <Features />
      </div>
    </>
  );
}

export default App;