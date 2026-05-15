import { Outlet } from "react-router-dom";
import StaffBottomNav from "./StaffBottomNav";
import InAppBrowserBanner from "./InAppBrowserBanner";

const StaffLayout = () => (
  <div className="min-h-screen bg-muted/30 pb-20">
    <InAppBrowserBanner />
    <Outlet />
    <StaffBottomNav />
  </div>
);

export default StaffLayout;
