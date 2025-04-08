import Navbar from "@/components/Navbar/Navbar";
import Features from "@/components/Features";
import { Button } from "@/components/common/button";
import { ArrowRight } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spin } from "antd";
import "./LoadingPage.css"; // Custom CSS for styling the loader

const Index = () => {
  const {
    loginWithRedirect,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
  } = useAuth0();
  const navigate = useNavigate();
  const [showLoading, setShowLoading] = useState(true);

  const handleSignUp = () => {
    loginWithRedirect();
  };

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setShowLoading(true);
      const timeout = setTimeout(() => {
        setShowLoading(false);
        // get token then set it to local storage
        getAccessTokenSilently({}).then((token) => {
          localStorage.setItem("access_token", token);
        });

        navigate("/home");
      }, 500);

      return () => clearTimeout(timeout);
    }

    if (!isAuthenticated && !isLoading) {
      setShowLoading(false);
    }
  }, [isAuthenticated, isLoading, navigate, getAccessTokenSilently]);

  if (isLoading || showLoading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p className="loading-message">Preparing your experience...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="pt-24 pb-20 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
              Verify Academic and Contest Submissions
            </h1>
            <p className="text-xl text-gray-600 mb-10">
              Empower educators and contest administrators with advanced
              AI-powered plagiarism detection. Ensure the integrity of student
              work and competition submissions.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={handleSignUp}
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Features />

      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-8">
              {[
                { step: "1", text: "Upload student or contestant submissions" },
                {
                  step: "2",
                  text: "Our AI analyzes content against other submissions",
                },
                { step: "3", text: "Review detailed originality reports" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {item.step}
                  </div>
                  <p className="text-lg">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>© 2024 SyntaxSentinels. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
