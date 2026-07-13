import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Terminal from "./Terminal";

function Hero() {
  const [target, setTarget] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const navigate = useNavigate();

const handleSubmit = (event) => {
  event.preventDefault();

  const cleanTarget = target.trim();

  if (!cleanTarget || isStarting) return;

  setIsStarting(true);

  setTimeout(() => {
    navigate("/scan", {
      state: {
        target: cleanTarget,
      },
    });
  }, 280);
};

  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-[70px] pt-[160px] pb-[80px] text-center max-[1000px]:px-[36px] max-[900px]:min-h-auto max-[900px]:px-[24px] max-[900px]:pt-[130px] max-[900px]:pb-[60px] max-[560px]:px-[16px]">
      <motion.div
        animate={
          isStarting
            ? {
                opacity: 0,
                y: -30,
                filter: "blur(8px)",
              }
            : {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }
        }
        transition={{
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
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
      </motion.div>

      <motion.form
        layoutId="scan-target-box"
        onSubmit={handleSubmit}
        transition={{
          layout: {
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          },
        }}
        className="relative z-50 mt-7 flex w-[500px] max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] p-[10px] backdrop-blur-[14px] focus-within:border-[#8bff6a]/35 focus-within:bg-white/10 focus-within:shadow-[0_0_0_4px_rgba(139,255,106,0.04),0_15px_50px_rgba(0,0,0,0.18)] max-[560px]:p-[7px]"
      >
        <motion.input
          layoutId="scan-target-text"
          type="text"
          value={target}
          disabled={isStarting}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="Enter domain, URL, IP or CIDR..."
          className="min-w-0 flex-1 bg-transparent px-[14px] text-[14px] text-white outline-none placeholder:text-white/50 disabled:cursor-wait max-[560px]:px-[9px] max-[560px]:text-[12px]"
        />

        <motion.button
          layoutId="scan-status-button"
          type="submit"
          disabled={isStarting}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white px-[18px] py-3 text-[14px] font-bold text-[#181468] transition hover:-translate-y-px hover:bg-[#f5f7ff] disabled:cursor-wait disabled:opacity-80 max-[560px]:px-[14px] max-[560px]:py-[11px] max-[560px]:text-[12px]"
        >
          {isStarting ? "Starting..." : "Start Scan"}
        </motion.button>
      </motion.form>

      <motion.div
        id="pipeline"
        animate={
          isStarting
            ? {
                opacity: 0,
                y: 40,
                scale: 0.97,
              }
            : {
                opacity: 1,
                y: 0,
                scale: 1,
              }
        }
        transition={{
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="mt-[80px] flex w-full items-center justify-center max-[900px]:mt-[55px] max-[560px]:mt-[45px]"
      >
        <Terminal />
      </motion.div>
    </section>
  );
}

export default Hero;