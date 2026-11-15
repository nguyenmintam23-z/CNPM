import CustomerHome from "./CustomerHome";
import CustomerHomeRoleGate from "../components/auth/CustomerHomeRoleGate";

// Giữ nguyên trang chủ cũ trong app/CustomerHome.tsx.
// Chỉ CUSTOMER được hiển thị menu tại "/".
export default function HomePage() {
  return (
    <CustomerHomeRoleGate>
      <CustomerHome />
    </CustomerHomeRoleGate>
  );
}
