import React, { useState } from "react";
import { Layout, Menu } from "antd";
import { Upload, FolderOpen } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

import Navbar from "@/components/Navbar/Navbar";
import AnalyzeFiles from "./AnalyzeFiles";
import UploadResults from "./UploadResults";

const { Sider, Content } = Layout;

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate("/");
  }

  const [collapsed, setCollapsed] = useState(true);
  const [activeKey, setActiveKey] = useState<"analyze" | "results">("analyze");

  return (
    <Layout style={{ minHeight: "100vh", position: "relative" }}>
      <Sider
        width={200}
        collapsedWidth={56}
        collapsible
        trigger={null}
        collapsed={collapsed}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        style={{
          height: "100vh",
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "hidden",
          borderRight: "1px solid #f0f0f0",
          transition: "all 0.5s ease",
          zIndex: 999,
          backgroundColor: "#fff",
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          style={{ height: "100%", borderRight: 0 }}
          onClick={({ key }) => {
            // Switch active tab and collapse the drawer
            setActiveKey(key as "analyze" | "results");
            setCollapsed(true);
          }}
        >
          <Menu.Item key="analyze" icon={<FolderOpen size={18} />}>
            Analyze Files
          </Menu.Item>
          {/* <Menu.Item key="results" icon={<Upload size={18} />}>
            Upload Results
          </Menu.Item> */}
        </Menu>
      </Sider>

      {/* Main content area, offset by 56px to accommodate the collapsed sidebar */}
      <Layout style={{ marginLeft: 56 }}>
        <Navbar />
        <Content style={{ padding: "2rem" }}>
          {activeKey === "analyze" && <AnalyzeFiles />}
          {/* {activeKey === "results" && <UploadResults />} */}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Home;
