// ==UserScript==
// @name         ShowDoc 接口文档导出工具
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  在 ShowDoc 页面添加快速导出 Markdown 文档的按钮，一键复制接口文档
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

;(function () {
  'use strict'

  // 检测是否为 ShowDoc 页面
  function isShowDocPage() {
    return (
      window.location.hostname.includes('showdoc.com') ||
      document.body.innerHTML.includes('www.showdoc.com') ||
      document.querySelector('#doc-title') !== null
    )
  }

  // 导出 ShowDoc 文档为 Markdown
  function exportShowDocToMarkdown(source) {
    let doc
    if (typeof source === 'string') {
      const parser = new DOMParser()
      doc = parser.parseFromString(source, 'text/html')
    } else {
      doc = source.ownerDocument || document
    }

    const titleElement = doc.querySelector('#doc-title')
    const title = titleElement ? titleElement.textContent.trim() : ''

    const contentElement = doc.querySelector('#editor-md') || doc.querySelector('#page_md_content')
    if (!contentElement) {
      throw new Error('未找到文档内容区域')
    }

    const markdown = []

    if (title) {
      markdown.push(`# ${title}\n`)
    }

    const headings = contentElement.querySelectorAll('h5')

    headings.forEach((heading) => {
      const sectionName = heading.textContent.trim().replace(/\s+/g, '')

      let currentElement = heading.nextElementSibling
      const sectionContent = []

      while (currentElement && currentElement.tagName !== 'H5') {
        sectionContent.push(currentElement)
        currentElement = currentElement.nextElementSibling
      }

      markdown.push(`## ${sectionName}\n`)

      sectionContent.forEach((element) => {
        const content = convertElementToMarkdown(element)
        if (content) {
          markdown.push(content)
          markdown.push('\n')
        }
      })

      markdown.push('\n')
    })

    return markdown.join('').trim()
  }

  function convertElementToMarkdown(element) {
    if (!element) return ''

    const tagName = element.tagName.toLowerCase()

    switch (tagName) {
      case 'ul':
        return convertListToMarkdown(element, false)

      case 'ol':
        return convertListToMarkdown(element, true)

      case 'table':
        return convertTableToMarkdown(element)

      case 'pre':
        return convertCodeBlockToMarkdown(element)

      case 'div': {
        const table = element.querySelector('table')
        if (table) {
          return convertTableToMarkdown(table)
        }
        const pre = element.querySelector('pre')
        if (pre) {
          return convertCodeBlockToMarkdown(pre)
        }
        return Array.from(element.childNodes)
          .map((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              return node.textContent.trim()
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              return convertElementToMarkdown(node)
            }
            return ''
          })
          .filter(Boolean)
          .join('\n')
      }

      case 'p':
        return `${element.textContent.trim()}\n`

      case 'code':
        return element.textContent.trim()

      default:
        return element.textContent.trim()
    }
  }

  function convertListToMarkdown(listElement, ordered = false) {
    const items = listElement.querySelectorAll('li')
    const markdown = []

    items.forEach((item, index) => {
      const text = item.textContent.trim()
      if (ordered) {
        markdown.push(`${index + 1}. ${text}`)
      } else {
        markdown.push(`- ${text}`)
      }
    })

    return markdown.join('\n')
  }

  function convertTableToMarkdown(tableElement) {
    const rows = tableElement.querySelectorAll('tr')
    if (rows.length === 0) return ''

    const markdown = []

    const headerRow = rows[0]
    const headers = Array.from(headerRow.querySelectorAll('th, td')).map((cell) => {
      return cell.textContent.trim()
    })

    if (headers.length > 0) {
      markdown.push(`| ${headers.join(' | ')} |`)
      markdown.push(`| ${headers.map(() => '---').join(' | ')} |`)
    }

    for (let i = 1; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td')).map((cell) => {
        return cell.textContent.trim().replace(/\|/g, '\\|')
      })

      if (cells.length > 0) {
        while (cells.length < headers.length) {
          cells.push('')
        }
        markdown.push(`| ${cells.slice(0, headers.length).join(' | ')} |`)
      }
    }

    return markdown.join('\n')
  }

  function convertCodeBlockToMarkdown(preElement) {
    const codeElement = preElement.querySelector('code')
    if (!codeElement) {
      return `\`\`\`\n${preElement.textContent.trim()}\n\`\`\``
    }

    const classList = codeElement.classList
    let language = ''

    for (const className of classList) {
      if (className.startsWith('hljs-') || className.startsWith('language-')) {
        language = className.replace('hljs-', '').replace('language-', '')
        break
      }
      const commonLanguages = [
        'json',
        'javascript',
        'typescript',
        'python',
        'java',
        'cpp',
        'c',
        'html',
        'css',
        'xml',
      ]
      if (commonLanguages.includes(className)) {
        language = className
        break
      }
    }

    if (!language) {
      const content = codeElement.textContent.trim()
      if (content.startsWith('{') || content.startsWith('[')) {
        language = 'json'
      }
    }

    let codeContent = codeElement.textContent || codeElement.innerText

    if (codeElement.innerHTML !== codeContent) {
      codeContent = extractTextFromElement(codeElement)
    }

    return `\`\`\`${language}\n${codeContent.trim()}\n\`\`\``
  }

  function extractTextFromElement(element) {
    let text = ''

    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') {
          text += '\n'
        }
        Array.from(node.childNodes).forEach(traverse)
      }
    }

    traverse(element)
    return text
  }

  // 复制到剪贴板
  function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => resolve(true))
          .catch((err) => reject(err))
      } else {
        // 降级方案：使用 document.execCommand
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          const success = document.execCommand('copy')
          document.body.removeChild(textarea)
          if (success) {
            resolve(true)
          } else {
            reject(new Error('复制失败'))
          }
        } catch (err) {
          document.body.removeChild(textarea)
          reject(err)
        }
      }
    })
  }

  // 显示提示消息
  function showMessage(message, type = 'success') {
    // 移除已存在的提示
    const existingMsg = document.getElementById('showdoc-export-message')
    if (existingMsg) {
      existingMsg.remove()
    }

    const msgDiv = document.createElement('div')
    msgDiv.id = 'showdoc-export-message'
    msgDiv.textContent = message
    msgDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${type === 'success' ? '#52c41a' : '#ff4d4f'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `

    // 添加动画样式
    if (!document.getElementById('showdoc-export-styles')) {
      const style = document.createElement('style')
      style.id = 'showdoc-export-styles'
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(msgDiv)

    // 3秒后自动移除
    setTimeout(() => {
      msgDiv.style.animation = 'fadeOut 0.3s ease-out'
      setTimeout(() => {
        if (msgDiv.parentNode) {
          msgDiv.remove()
        }
      }, 300)
    }, 3000)
  }

  // 创建导出按钮
  function createExportButton() {
    // 检查是否已存在按钮
    if (document.getElementById('showdoc-export-btn')) {
      return
    }

    const btn = document.createElement('button')
    btn.id = 'showdoc-export-btn'
    btn.textContent = '📋 复制文档'
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      padding: 12px 24px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
      z-index: 9999;
      transition: all 0.3s ease;
      user-select: none;
    `

    // 悬停效果
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#40a9ff'
      btn.style.transform = 'translateY(-2px)'
      btn.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.4)'
    })

    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#1890ff'
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.3)'
    })

    // 点击事件
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true
        btn.textContent = '⏳ 导出中...'
        btn.style.cursor = 'wait'

        const markdown = exportShowDocToMarkdown(document)
        await copyToClipboard(markdown)

        showMessage('✅ Markdown 文档已复制到剪贴板！', 'success')
        btn.textContent = '✅ 已复制'
        btn.style.background = '#52c41a'

        // 2秒后恢复按钮状态
        setTimeout(() => {
          btn.textContent = '📋 复制文档'
          btn.style.background = '#1890ff'
          btn.disabled = false
          btn.style.cursor = 'pointer'
        }, 2000)
      } catch (error) {
        console.error('导出失败：', error)
        showMessage('❌ 导出失败：' + error.message, 'error')
        btn.textContent = '📋 复制文档'
        btn.style.background = '#1890ff'
        btn.disabled = false
        btn.style.cursor = 'pointer'
      }
    })

    document.body.appendChild(btn)
  }

  // 初始化
  function init() {
    if (isShowDocPage()) {
      // 等待页面加载完成后再创建按钮
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(createExportButton, 500)
        })
      } else {
        setTimeout(createExportButton, 500)
      }
    }
  }

  // 监听页面变化（SPA 应用）
  let lastUrl = location.href
  new MutationObserver(() => {
    const url = location.href
    if (url !== lastUrl) {
      lastUrl = url
      // 移除旧按钮
      const oldBtn = document.getElementById('showdoc-export-btn')
      if (oldBtn) {
        oldBtn.remove()
      }
      // 重新初始化
      setTimeout(init, 500)
    }
  }).observe(document, { subtree: true, childList: true })

  // 启动
  init()
})()

