import { useNavigate } from "react-router-dom";
import { signOut } from "../services/authService";
import "../Styles/AppHeader.css";

export function AppHeader() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="AppHeader">
      <button type="button" className="GhostButton" onClick={handleSignOut}>
        登出
      </button>
    </header>
  );
}
