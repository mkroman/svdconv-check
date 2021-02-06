import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

const SVDCONV_VERSION: string = '3.3.35';

/// Attempts to download the SVDConv tool and returns the path to it
async function init(): Promise<string> {
  let svdConvPath: string = '';
  let cachedPath: string = '';

  if (process.platform == 'win32') {
    cachedPath = tc.find('SVDConv.exe', SVDCONV_VERSION);

    if (cachedPath == '') {
      svdConvPath = await tc.downloadTool('https://github.com/ARM-software/CMSIS_5/blob/4b069d7bcb9ea77251ae2283db2ee650767f0f50/CMSIS/Utilities/Win32/SVDConv.exe');
      cachedPath = await tc.cacheFile(svdConvPath, 'SVDConv.exe', 'SVDConv', SVDCONV_VERSION);
    }
  } else if (process.platform == 'linux') {
    cachedPath = tc.find('SVDConv', SVDCONV_VERSION);

    if (cachedPath == '') {
      svdConvPath = await tc.downloadTool('https://github.com/ARM-software/CMSIS_5/raw/4b069d7bcb9ea77251ae2283db2ee650767f0f50/CMSIS/Utilities/Linux64/SVDConv');
      cachedPath = await tc.cacheFile(svdConvPath, 'SVDConv', 'SVDConv', SVDCONV_VERSION);
    }
  } else {
    core.setFailed(`Unsupported platform ${process.platform}`);
  }

  return cachedPath;
}

async function main(): Promise<void> {
  const svdConvPath = await init();
  core.addPath(svdConvPath);

  let executable = process.platform == 'win32' ? 'SVDConv.exe' : 'SVDConv';
  let output = '';

  await exec.exec(executable, [], { listeners: { stdout: (data: Buffer) => { 
    output += data.toString();
  }}});

  core.info(`svdConvPath: ${svdConvPath}`);
  core.info(`output: ${output}`);
}

main();
