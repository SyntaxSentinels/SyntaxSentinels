import { Button } from "@/components/common/button";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import "./Navbar.css"; // CSS file for additional styling

const Navbar = () => {
  const { loginWithRedirect, isAuthenticated, logout } = useAuth0();

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
    // remove token from local storage
    localStorage.removeItem("access_token");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo aligned to the left */}
        <Link to="/" className="text-2xl font-bold text-primary">
          SyntaxSentinels
        </Link>

        {/* Buttons aligned to the right */}
        <div className="navbar-actions">
          {!isAuthenticated && (
            <Button
              className="navbar-button"
              onClick={() => loginWithRedirect()}
            >
              Log In
            </Button>
          )}
          {isAuthenticated && (
            <Button
              className="navbar-button bg-primary hover:bg-primary/90"
              onClick={() => handleLogout()}
            >
              Log Out
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
