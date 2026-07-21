import { Route, Routes } from "react-router-dom";

import SharedLayout from "./layouts/SharedLayout";
import LandingPage from "./pages/LandingPage";
import ScanPage from "./pages/ScanPage";

function App() {
  return (
    <Routes>
      <Route element={<SharedLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/scan" element={<ScanPage />} />
      </Route>
    </Routes>
  );
}

export default App;