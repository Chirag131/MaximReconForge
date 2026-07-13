import { LayoutGroup, motion, AnimatePresence } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import Navbar from "../components/Navbar";

function SharedLayout() {
  const location = useLocation();
  const outlet = useOutlet();

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

        <LayoutGroup id="recon-layout">
          <main className="relative min-h-screen">
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={location.pathname}
                className="min-h-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </main>
        </LayoutGroup>
      </div>
    </>
  );
}

export default SharedLayout;