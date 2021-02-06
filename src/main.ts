import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as fs from 'fs';

const SVDCONV_VERSION: string = '3.3.35';

/// Attempts to download the SVDConv tool and returns the path to it
async function init(): Promise<string> {
  let svdConvPath: string = '';
  let cachedPath: string = '';

  let executableName = 'SVDConv';
  let url = '';

  if (process.platform != 'win32' && process.platform != 'linux') {
    core.setFailed(`Unsupported platform ${process.platform}`);

    throw new Error(`Unsupported platform ${process.platform}`);
  }

  if (process.platform == 'linux') {
    url = 'https://github.com/ARM-software/CMSIS_5/raw/4b069d7bcb9ea77251ae2283db2ee650767f0f50/CMSIS/Utilities/Linux64/SVDConv';
  } else if (process.platform == 'win32') {
    executableName = 'SVDConv.exe';
    url = 'https://github.com/ARM-software/CMSIS_5/blob/4b069d7bcb9ea77251ae2283db2ee650767f0f50/CMSIS/Utilities/Win32/SVDConv.exe';
  }

  cachedPath = tc.find(executableName, SVDCONV_VERSION);

  if (cachedPath == '') {
    svdConvPath = await tc.downloadTool(url);
    cachedPath = await tc.cacheFile(svdConvPath, executableName, 'SVDConv', SVDCONV_VERSION);
  }

  return path.join(cachedPath, executableName);
}

async function main(): Promise<void> {
  const svdConvPath = await init();
  const svdConvDir = path.dirname(svdConvPath);
  const svdConvExe = path.basename(svdConvPath);

  fs.chmodSync(svdConvPath, 0o775);
  core.addPath(svdConvDir);

  // Get the input svd file
  const svdPath = core.getInput('path', { required: true });

  let output = '';

  await exec.exec(svdConvExe, [svdPath], { listeners: { stdout: (data: Buffer) => { 
    output += data.toString();
  }}});

  core.info(`svdConvPath: ${svdConvPath}`);
  core.info(`output: ${output}`);
}

main();
