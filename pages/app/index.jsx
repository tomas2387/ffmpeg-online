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

  const handleExec = async () => {
    if (!file) {
      return;
    }
    setOutputFiles([]);
    setHref("");
    setDownloadFileName("");
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
      setTip("start executing the command");
      const outputText = await ffmpeg.current.run(
        '-i',
        name,
        '-v', 'error', '-f', 'null',
        output
      );
      console.error(outputText);
      setSpinning(false);
      const FSls = ffmpeg.current.FS("readdir", ".");
      const outputFiles = FSls.filter((i) => !currentFSls.current.includes(i));
      if (outputFiles.length === 1) {
        const data = ffmpeg.current.FS("readFile", outputFiles[0]);
        const type = await fileTypeFromBuffer(data.buffer);

        const objectURL = URL.createObjectURL(
          new Blob([data.buffer], { type: type.mime })
        );
        setHref(objectURL);
        setDownloadFileName(outputFiles[0]);
        message.success(
          "Run successfully, click the download button to download the output file",
          10
        );
      } else if (outputFiles.length > 1) {
        var zip = new JSZip();
        outputFiles.forEach((filleName) => {
          const data = ffmpeg.current.FS("readFile", filleName);
          zip.file(filleName, data);
        });
        const zipFile = await zip.generateAsync({ type: "blob" });
        const objectURL = URL.createObjectURL(zipFile);
        setHref(objectURL);
        setDownloadFileName("output.zip");
        message.success(
          "Run successfully, click the download button to download the output file",
          10
        );
      } else {
        message.success(
          "Run successfully, No files are generated, if you want to see the output of the ffmpeg command, please open the console",
          10
        );
      }
    } catch (err) {
      console.error(err);
      message.error(
        "Failed to run, please check if the command is correct or open the console to view the error details",
        10
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

      <h2 align="center">ffmpeg-online</h2>

      <h4>1. Select file</h4>
      <p style={{ color: "gray" }}>
        Your files will not be uploaded to the server, only processed in the
        browser
      </p>
      <Dragger
        multiple
        beforeUpload={(file, fileList) => {
          setFile(file);
          setFileList((v) => [...v, ...fileList]);
          setName(file.name);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag file</p>
      </Dragger>
      <h4>2. Set ffmpeg options</h4>
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
      <h4>3. Run and get the output file</h4>
      <Button type="primary" disabled={!Boolean(file)} onClick={handleExec}>
        run
      </Button>
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
      <br />
      <br />

      <Analytics />
    </div>
  );
};

export default App;
