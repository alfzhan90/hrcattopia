import { Outlet } from "react-router-dom";
import StaffBottomNav from "./StaffBottomNav";

const StaffLayout = () => (
  <div className="min-h-screen bg-muted/30 pb-20">
    <Outlet />
    <StaffBottomNav />
  </div>
);

export default StaffLayout;
