import JSONEditor from 'jsoneditor'
import 'jsoneditor/dist/jsoneditor.min.css'
import { Aria2RPC } from 'node-aria2'
import path from 'node:path'

import {
  GM_registerMenuCommand,
  GM_listValues,
  GM_getValue,
  GM_setValue,
  GM_deleteValue
} from '$'

const DEFAULT_CONFIG = {
  'aria2-rpc-address': 'ws://localhost:6800/jsonrpc',
  'aria2-rpc-secret': '',
  'aria2-download-path': ''
}

function cleanupConfig () {
  for (const key of GM_listValues()) {
    if ([null, undefined].includes(GM_getValue(key))) {
      GM_deleteValue(key)
    }
  }
}

function loadConfig () {
  const configStr = GM_getValue('config') as string
  if (configStr) {
    return JSON.parse(configStr)
  }
  return DEFAULT_CONFIG
}

function createJsonEditor (initial: JSON, onChange: (a: string) => void) {
  const container = document.createElement('div') as HTMLDivElement
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.display = 'flex'
  container.style.justifyContent = 'center'
  container.style.alignItems = 'center'
  container.style.zIndex = '999999998'

  const closeButton = document.createElement('button')
  closeButton.innerHTML = '关闭'
  closeButton.style.position = 'absolute'
  closeButton.style.right = '10px'
  closeButton.style.bottom = '10px'
  closeButton.style.display = 'flex'
  closeButton.style.zIndex = '999999999'
  closeButton.onclick = () => {
    // 点击关闭按钮后的操作，比如隐藏jsoneditor
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
  container.appendChild(closeButton)
  document.body.appendChild(container)
  new JSONEditor(container, { onChangeText: onChange }, initial)
}

function modifyConfig () {
  createJsonEditor(loadConfig(), (newConfig: string) => {
    GM_setValue('config', newConfig)
  })
}

function getCollectTitle () {
  const titleSelector = '#video-playlist-wrapper h4'
  const titleTag = document.querySelector(titleSelector)
  if (!titleTag) {
    throw new Error(`Invalid title selector ${titleSelector}`)
  }
  const title = titleTag.textContent
  if (!title) {
    throw new Error(`Invalid title`)
  }
  return title
}

function getDownloadPageURL (watchURL: string) {
  // 获取当前页面的 URL
  const url = new URL(watchURL)
  const baseURL = url.origin

  const params = url.searchParams
  let videoID = params.get('v')
  let downloadPageURL = `${baseURL}/download?v=${videoID}`

  return downloadPageURL
}

function getAllDownloadPageURL () {
  const urlTagList = document
    .querySelector('#video-playlist-wrapper')
    ?.querySelectorAll('a.overlay')
  if (!urlTagList || urlTagList.length === 0) {
    throw new Error(`Invalid urlTag selector`)
  }
  const urlList = Array.from(urlTagList).map((tag: any) => {
    return getDownloadPageURL(tag.href)
  })
  return urlList
}

async function getDownloadInfo (downloadPageURL: string) {
  const resp = await fetch(downloadPageURL)
  const data = await resp.text()
  const iframe = document.createElement('iframe')
  iframe.srcdoc = data
  iframe.style.display = 'none'
  document.body.appendChild(iframe)
  await new Promise(resolve => (iframe.onload = resolve))
  const doc = iframe.contentDocument as Document

  try {
    const titleSelector =
      '#content-div > div.row.no-gutter.video-show-width.download-panel > div.col-md-12 > div > div > h3'
    const titleTag = doc.querySelector(titleSelector)
    if (!titleTag) {
      throw new Error(`no title for download page ${downloadPageURL}`)
    }
    const title = titleTag.textContent
    const urlSelector = 'table.download-table a'
    const urlTag: any = doc.querySelector(urlSelector)
    if (!urlTag) {
      throw new Error(`no url for download page ${downloadPageURL}`)
    }
    const url = urlTag.href
    return {
      title: title,
      url: url
    }
  } catch (error) {
    throw error
  } finally {
    iframe.remove()
  }
}

async function addDownloadTask (collectTitle: string, downloadInfoList: any) {
  const config = loadConfig()
  console.log(config)

  let url = new URL(config['aria2-rpc-address'])

  const aria2 = new Aria2RPC(
    {
      host: url.hostname,
      port: parseInt(url.port),
      secure: url.protocol == 'wss:',
      secret: config['aria2-rpc-secret'],
      path: url.pathname
    },
    { WebSocket: WebSocket, fetch: fetch }
  )

  await aria2.open()
  try {
    const multicall = downloadInfoList.map((info: any) => [
      'aria2.addUri',
      [info.url],
      {
        dir: path.join(config['aria2-download-path'], collectTitle),
        out: `${info.title}.mp4`
      }
    ])
    console.log(multicall)
    const result = await aria2.multicall(multicall)
    console.log(result)
  } finally {
    await aria2.close()
  }
}

async function downloadCollection () {
  const collectTitle = getCollectTitle()
  console.log(collectTitle)
  const urlList = getAllDownloadPageURL()
  console.log(urlList)
  const downloadInfoList = await Promise.all(
    urlList.map(url => {
      return getDownloadInfo(url)
    })
  )
  console.log(downloadInfoList)
  await addDownloadTask(collectTitle, downloadInfoList)
}

async function downloadOne () {
  const collectTitle = getCollectTitle()
  console.log(collectTitle)
  const urlList = [getDownloadPageURL(window.location.href)]
  const downloadInfoList = await Promise.all(
    urlList.map(url => {
      return getDownloadInfo(url)
    })
  )
  console.log(downloadInfoList)
  await addDownloadTask(collectTitle, downloadInfoList)
}

cleanupConfig()
GM_registerMenuCommand('设置', modifyConfig)
GM_registerMenuCommand('下载本集', downloadOne)
GM_registerMenuCommand('下载合集', downloadCollection)
