import { StudentPortalClient } from "./student-portal-client";

export const metadata = {
  title: "Student Portal | NOVA School Management ERP",
  description: "Self-service student portal for enrolled curriculum, timetable, attendance, academic reports, and digital exeat passes."
};

export default function StudentPortalPage() {
  return <StudentPortalClient />;
}
