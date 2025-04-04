import React, { useState } from "react";
import { Table, Tag, Button, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { JobInfo } from "@/services/ssApi";

interface JobsTableProps {
  jobs: JobInfo[];
  loading: boolean;
}

const JobsTable: React.FC<JobsTableProps> = ({ jobs, loading }) => {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(5);

  // Format date to a readable string
  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  // Handle click on a job row
  const handleViewResults = (jobId: string) => {
    navigate(`/results?jobId=${jobId}`);
  };

  // Handle page size change
  const handlePageSizeChange = (current: number, size: number) => {
    setPageSize(size);
  };

  // Define table columns
  const columns: ColumnsType<JobInfo> = [
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        let color = "";
        let icon = null;

        switch (status) {
          case "completed":
            color = "success";
            icon = <CheckCircleOutlined />;
            break;
          case "processing":
            color = "processing";
            icon = <SyncOutlined spin />;
            break;
          case "pending":
            color = "warning";
            icon = <ClockCircleOutlined />;
            break;
          case "failed":
            color = "error";
            icon = <CloseCircleOutlined />;
            break;
          default:
            color = "default";
        }

        return (
          <Tag color={color} icon={icon}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: "Analysis Name",
      dataIndex: "analysisName",
      key: "analysisName",
      render: (text: string) => text || "Unnamed Analysis",
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: Date) => (
        <Tooltip title={formatDate(date)}>
          {date ? new Date(date).toLocaleDateString() : "N/A"}
        </Tooltip>
      ),
    },
    // {
    //   title: "Last Updated",
    //   dataIndex: "updatedAt",
    //   key: "updatedAt",
    //   render: (date: Date) => (s
    //     <Tooltip title={formatDate(date)}>
    //       {date ? new Date(date).toLocaleDateString() : "N/A"}
    //     </Tooltip>
    //   ),
    // },
    {
      title: "",
      key: "actions",
      render: (_, record) => (
        <Button
          type="primary"
          onClick={() => handleViewResults(record.jobId)}
          disabled={record.status !== "completed"}
        >
          View Results
        </Button>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={jobs}
      rowKey="jobId"
      loading={loading}
      pagination={{ 
        pageSize: pageSize,
        showSizeChanger: true,
        pageSizeOptions: ['5', '10', '20', '50'],
        onShowSizeChange: handlePageSizeChange
      }}
      className="jobs-table"
    />
  );
};

export default JobsTable;
