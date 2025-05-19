import { Spin, Upload, Input, Button, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { InboxOutlined } from "@ant-design/icons";
import { fileTypeFromBuffer } from "file-type";
import { Analytics } from "@vercel/analytics/react";
import numerify from "numerify/lib/index.cjs";
import qs from "query-string";
import JSZip from "jszip";

const { Dragger } = Upload;

const App = () => {
  const [spinning, setSpinning] = useState(false);
  const [tip, setTip] = useState(false);
  const [inputOptions, setInputOptions] = useState("-i");
  const [outputOptions, setOutputOptions] = useState("");
  const [files, setFiles] = useState("");
  const [outputFiles, setOutputFiles] = useState([]);
  const [href, setHref] = useState("");
  const [file, setFile] = useState();
  const [fileList, setFileList] = useState([]);
  const [name, setName] = useState("input.mp4");
  const [output, setOutput] = useState("output.mp4");
  const [downloadFileName, setDownloadFileName] = useState("output.mp4");
  const ffmpeg = useRef();
  const currentFSls = useRef([]);

  const [validationResult, setValidationResult] = useState("");

  const handleExec = async () => {
    if (!file) {
      return;
    }
    setOutputFiles([]);
    setHref("");
    setDownloadFileName("");
    setValidationResult("");
    try {
      setTip("Loading file into browser");
      setSpinning(true);
      for (const fileItem of fileList) {
        ffmpeg.current.FS(
          "writeFile",
          fileItem.name,
          await fetchFile(fileItem)
        );
      }
      currentFSls.current = ffmpeg.current.FS("readdir", ".");
      setTip("Validating video file...");

      // Run FFmpeg with parameters to validate the video file
      let outputText = "";
      try {
        outputText = await ffmpeg.current.run(
          '-i',
          name,
          '-v', 'error', '-f', 'null',
          '-'
        );
        // If we reach here with no errors, the video is valid
        setValidationResult("✅ Video file is valid and can be processed by FFmpeg.");
        message.success("Video validation completed successfully", 5);
      } catch (ffmpegError) {
        // If FFmpeg throws an error, the video might have issues
        outputText = ffmpegError.message || "Unknown error occurred during validation";
        setValidationResult("❌ Video file has issues: " + outputText);
        message.warning("Video has some issues. See details below.", 5);
      }

      setSpinning(false);
    } catch (err) {
      console.error(err);
      setSpinning(false);
      setValidationResult("❌ Error processing file: " + (err.message || "Unknown error"));
      message.error(
        "Failed to validate video. Please try another file.",
        5
      );
    }
  };

  const handleGetFiles = async () => {
    if (!files) {
      return;
    }
    const filenames = files
      .split(",")
      .filter((i) => i)
      .map((i) => i.trim());
    const outputFilesData = [];
    for (let filename of filenames) {
      try {
        const data = ffmpeg.current.FS("readFile", filename);
        const type = await fileTypeFromBuffer(data.buffer);

        const objectURL = URL.createObjectURL(
          new Blob([data.buffer], { type: type.mime })
        );
        outputFilesData.push({
          name: filename,
          href: objectURL,
        });
      } catch (err) {
        message.error(`${filename} get failed`);
        console.error(err);
      }
    }
    setOutputFiles(outputFilesData);
  };

  useEffect(() => {
    (async () => {
      ffmpeg.current = createFFmpeg({
        log: true,
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      ffmpeg.current.setProgress(({ ratio }) => {
        console.log(ratio);
        setTip(numerify(ratio, "0.0%"));
      });
      setTip("ffmpeg static resource loading...");
      setSpinning(true);
      await ffmpeg.current.load();
      setSpinning(false);
    })();
  }, []);

  useEffect(() => {
    const { inputOptions, outputOptions, output } = qs.parse(
      window.location.search
    );
    if (inputOptions) {
      setInputOptions(inputOptions);
    }
    if (outputOptions) {
      setOutputOptions(outputOptions);
    }
    if (output) {
      setOutput(output);
    }
  }, []);

  useEffect(() => {
    // run after inputOptions and outputOptions set from querystring
    setTimeout(() => {
      let queryString = qs.stringify({ inputOptions, outputOptions, output });
      const newUrl = `${location.origin}${location.pathname}?${queryString}`;
      history.pushState("", "", newUrl);
    });
  }, [inputOptions, outputOptions, output]);

  return (
    <div className="page-app">
      {spinning && (
        <Spin spinning={spinning} tip={tip}>
          <div className="component-spin" />
        </Spin>
      )}

      <h2 align="center">Video Validator</h2>
      <p align="center" style={{ color: "gray", marginBottom: "20px" }}>
        A simple tool to check if your video files are valid
      </p>

      <h4>Upload your video file</h4>
      <p style={{ color: "gray" }}>
        Your file will not be uploaded to any server, it will only be processed in your
        browser for validation
      </p>
      <Dragger
        multiple={false}
        beforeUpload={async (file, fileList) => {
          setFile(file);
          setFileList([file]);
          setName(file.name);

          // Automatically run validation when file is uploaded
          setTimeout(() => {
            handleExec();
          }, 100);

          return false;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag video file to validate</p>
        <p className="ant-upload-hint">Your file will be processed in the browser and not uploaded to any server</p>
      </Dragger>

      {validationResult && (
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #d9d9d9', borderRadius: '4px', backgroundColor: '#f5f5f5' }}>
          <h4>Video Validation Result:</h4>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {validationResult}
          </div>
        </div>
      )}

      {/* Hidden section for advanced users - can be toggled if needed */}
      <div style={{ display: 'none' }}>
        <h4>Advanced Options</h4>
        <div className="exec">
          ffmpeg
          <Input
            value={inputOptions}
            placeholder="please enter input options"
            onChange={(event) => setInputOptions(event.target.value)}
          />
          <Input
            value={name}
            placeholder="please enter input filename"
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            value={outputOptions}
            placeholder="please enter output options"
            onChange={(event) => setOutputOptions(event.target.value)}
          />
          <Input
            value={output}
            placeholder="Please enter the download file name"
            onChange={(event) => setOutput(event.target.value)}
          />
          <div className="command-text">
            ffmpeg {inputOptions} {name} {outputOptions} {output}
          </div>
        </div>
        <Button type="primary" disabled={!Boolean(file)} onClick={handleExec}>
          Validate Again
        </Button>
      </div>

      {/* Hidden download section - not needed for simple validation */}
      <div style={{ display: 'none' }}>
        <br />
        <br />
        {href && (
          <a href={href} download={downloadFileName}>
            download file
          </a>
        )}
        <h4>4. Get other file from file system (use , split)</h4>
        <p style={{ color: "gray" }}>
          In some scenarios, the output file contains multiple files. At this
          time, multiple file names can be separated by commas and typed into the
          input box below.
        </p>
        <Input
          value={files}
          placeholder="Please enter the download file name"
          onChange={(event) => setFiles(event.target.value)}
        />
        <Button type="primary" disabled={!Boolean(file)} onClick={handleGetFiles}>
          confirm
        </Button>
        <br />
        <br />
        {outputFiles.map((outputFile, index) => (
          <div key={index}>
            <a href={outputFile.href} download={outputFile.name}>
              {outputFile.name}
            </a>
            <br />
          </div>
        ))}
      </div>

      <br />
      <br />

      <Analytics />
    </div>
  );
};

export default App;
