import { useState } from "react";
import Terminal from "./Terminal";

function Hero() {
  const [target, setTarget] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!target.trim()) {
      return;
    }

    console.log("Starting scan for:", target);
  };

  return (
    <section className="hero">
      <div>
        <div className="badge">Attack Surface Recon Platform</div>

        <h1>Map your attack surface before attackers do.</h1>

        <p className="sub">
          ReconForge automates subdomain discovery, live host detection, URL
          crawling, port scanning, and clean security reporting in one simple
          recon pipeline.
        </p>
      </div>

      <form className="target-box" onSubmit={handleSubmit}>
        <input
          type="text"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="Enter domain, URL, IP or CIDR..."
        />

        <button type="submit">Start Scan</button>
      </form>

      <div className="pipeline-wrap" id="pipeline">
        <Terminal />
      </div>
    </section>
  );
}

export default Hero;