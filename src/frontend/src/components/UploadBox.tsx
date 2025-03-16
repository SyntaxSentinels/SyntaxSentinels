import { Input, message, List, Button } from "antd";
import { InboxOutlined, CloseOutlined } from "@ant-design/icons";
import React, { useState, useEffect } from "react";
import { cacheFiles } from "@/services/fileCacheService";

const UploadBox = ({ onFileListChange, mode, clearFiles, setClearFiles }) => {
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    if (clearFiles) {
      setFileList([]);
      if (onFileListChange) {
        onFileListChange([]);
      }
      setClearFiles(false);
    }
  }, [clearFiles, onFileListChange, setClearFiles]);

  useEffect(() => {
    const handleWindowDrop = (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    };

    const handleWindowDragOver = (e) => {
      e.preventDefault();
    };

    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragover", handleWindowDragOver);

    return () => {
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, []);

  const handleFiles = (files) => {
    if (files.length === 0) return;

    const validFiles = files.filter((file) =>
      mode === "analyze"
        ? file.name.endsWith(".zip") || file.name.endsWith(".py")
        : file.name.endsWith(".zip")
    );

    if (validFiles.length === 0) {
      message.error(
        `Invalid file type. Only ${
          mode === "analyze" ? ".zip and .py" : ".zip"
        } files are allowed.`
      );
      return;
    }

    // Only allow one ZIP file at a time if not in analyze mode
    if (mode === "analyze") {
      setFileList((prevFileList) => {
        const newFileList = [...prevFileList, ...files];
        if (onFileListChange) {
          onFileListChange(newFileList);
        }
        return newFileList;
      });
    } else {
      const newFileList = validFiles.slice(0, 1);
      setFileList(newFileList);

      if (onFileListChange) {
        onFileListChange(newFileList[0]); // Ensure only one file is passed
      }

      message.success(`File uploaded successfully: ${newFileList[0].name}`);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleRemoveFile = (fileToRemove) => {
    setFileList((prevFileList) => {
      const newFileList = prevFileList.filter((file) => file !== fileToRemove);
      if (onFileListChange) {
        onFileListChange(newFileList);
      }
      return newFileList;
    });
  };

  return (
    <div
      style={{
        padding: "20px",
        border: "1px dashed #d9d9d9",
        borderRadius: "4px",
        textAlign: "center",
      }}
    >
      <InboxOutlined style={{ fontSize: "32px", color: "#1890ff" }} />
      <p>Click or drag file to this area to upload</p>
      <p>
        {mode === "analyze"
          ? "Supports .zip and .py files"
          : "Supports .zip files"}
      </p>
      <Input
        type="file"
        accept={mode === "analyze" ? ".zip,.py" : ".zip"}
        onChange={handleFileChange}
        style={{ display: "none" }}
        id="file-upload"
        multiple={mode === "analyze"}
      />
      <label
        htmlFor="file-upload"
        style={{ cursor: "pointer", color: "#1890ff" }}
      >
        Browse Files
      </label>
      <List
        style={{ marginTop: "20px", maxHeight: "200px", overflowY: "auto" }}
        bordered
        dataSource={fileList}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => handleRemoveFile(item)}
              />,
            ]}
          >
            {item.name}
          </List.Item>
        )}
      />
    </div>
  );
};

export default UploadBox;
