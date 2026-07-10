import { useState } from "react";
import Terminal from "./Terminal";

function Hero() {
  const [target, setTarget] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!target.trim()) return;

    console.log("Starting scan for:", target);
  };

  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-[70px] pt-[160px] pb-[80px] text-center max-[1000px]:px-[36px] max-[900px]:min-h-auto max-[900px]:px-[24px] max-[900px]:pt-[130px] max-[900px]:pb-[60px] max-[560px]:px-[16px]">
      <div>
        <div className="mx-auto mb-7 w-fit text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70 max-[560px]:mb-5 max-[560px]:text-[11px]">
          Attack Surface Recon Platform
        </div>

        <h1 className="mx-auto max-w-[900px] text-[68px] font-extrabold leading-[1.05] tracking-[-3px] max-[1000px]:text-[58px] max-[900px]:text-[46px] max-[900px]:leading-[1.08] max-[900px]:tracking-[-2px] max-[560px]:text-[38px] max-[560px]:tracking-[-1.7px]">
          Map your attack surface before attackers do.
        </h1>

        <p className="mx-auto mt-7 max-w-[700px] text-[19px] leading-[1.8] text-[#a8aec7] max-[900px]:text-[17px] max-[900px]:leading-[1.7] max-[560px]:mt-[22px] max-[560px]:text-[15px]">
          ReconForge automates subdomain discovery, live host detection, URL
          crawling, port scanning, and clean security reporting in one simple
          recon pipeline.
        </p>
      </div>

      {/* Keep CSS for now */}
      <form
  onSubmit={handleSubmit}
  className="
    mt-7 flex w-[500px] max-w-full items-center gap-2
    rounded-full border border-white/10
    bg-white/[0.08] p-[10px]
    backdrop-blur-[14px]
    transition
    focus-within:border-[#8bff6a]/35
    focus-within:bg-white/10
    focus-within:shadow-[0_0_0_4px_rgba(139,255,106,0.04),0_15px_50px_rgba(0,0,0,0.18)]
    max-[560px]:p-[7px]
  "
>
  <input
    type="text"
    value={target}
    onChange={(event) => setTarget(event.target.value)}
    placeholder="Enter domain, URL, IP or CIDR..."
    className="
      min-w-0 flex-1 bg-transparent px-[14px]
      text-[14px] text-white outline-none
      placeholder:text-white/50
      max-[560px]:px-[9px]
      max-[560px]:text-[12px]
    "
  />

  <button
    type="submit"
    className="
      shrink-0 cursor-pointer rounded-full border-none
      bg-white px-[18px] py-3
      text-[14px] font-bold text-[#181468]
      transition duration-200
      hover:-translate-y-px
      hover:bg-[#f5f7ff]
      hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)]
      active:translate-y-0
      max-[560px]:px-[14px]
      max-[560px]:py-[11px]
      max-[560px]:text-[12px]
    "
  >
    Start Scan
  </button>
</form>

      <div
  id="pipeline"
  className="
    mt-[80px] flex w-full items-center justify-center
    max-[900px]:mt-[55px]
    max-[560px]:mt-[45px]
  "
>
  <Terminal />
</div>
    </section>
  );
}

export default Hero;