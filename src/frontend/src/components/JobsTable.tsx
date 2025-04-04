import React, { useState } from "react";
import { Table, Tag, Button, Tooltip, Popconfirm, message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { JobInfo } from "@/services/ssApi";
import { deleteJob } from "@/services/ssApi";
import "./JobsTable.css";

interface JobsTableProps {
  jobs: JobInfo[];
  loading: boolean;
  onJobDeleted?: () => void;
}

const JobsTable: React.FC<JobsTableProps> = ({ jobs, loading, onJobDeleted }) => {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(5);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

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

  // Handle job deletion
  const handleDeleteJob = async (jobId: string) => {
    try {
      setDeletingJobId(jobId);
      await deleteJob(jobId);
      message.success("Job deleted successfully");
      if (onJobDeleted) {
        onJobDeleted();
      }
    } catch (error) {
      console.error("Error deleting job:", error);
      message.error("Failed to delete job");
    } finally {
      setDeletingJobId(null);
    }
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
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            type="primary"
            onClick={() => handleViewResults(record.jobId)}
            disabled={record.status !== "completed"}
          >
            View Results
          </Button>
          <Popconfirm
            title="Delete Job"
            description="Are you sure you want to delete this job? This action cannot be undone."
            onConfirm={() => handleDeleteJob(record.jobId)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deletingJobId === record.jobId}
              className="delete-button"
              disabled={record.status !== "completed" && record.status !== "failed"}
              title={record.status !== "completed" && record.status !== "failed" ? "Can only delete completed or failed jobs" : "Delete job"}
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
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
