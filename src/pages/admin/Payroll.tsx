import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AttendanceCorrection from "@/components/payroll/AttendanceCorrection";
import LeaveManagement from "@/components/payroll/LeaveManagement";
import HolidayCalendar from "@/components/payroll/HolidayCalendar";
import PayrollProcessing from "@/components/payroll/PayrollProcessing";

const Payroll = () => {
  const [tab, setTab] = useState("payroll");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll & Compliance</h1>
        <p className="text-muted-foreground">Process payroll, manage leave, holidays, and attendance corrections.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="attendance">Time Correction</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="mt-4">
          <PayrollProcessing />
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <AttendanceCorrection />
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          <LeaveManagement />
        </TabsContent>
        <TabsContent value="holidays" className="mt-4">
          <HolidayCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Payroll;
