<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            color: #333;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
          }
          .header {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
            color: #2c3e50;
          }
          .description {
            color: #666;
            line-height: 1.6;
          }
          table {
            width: 100%;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-collapse: collapse;
            overflow: hidden;
          }
          th {
            background: #6B7A5E;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #eee;
          }
          tr:hover {
            background: #f9f9f9;
          }
          tr:last-child td {
            border-bottom: none;
          }
          a {
            color: #6B7A5E;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .url-cell {
            max-width: 500px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .count {
            color: #666;
            margin-top: 20px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>XML Sitemap</h1>
          <div class="description">
            This is an XML Sitemap for search engines like Google, Bing, and others.
            You can learn more about XML sitemaps on <a href="https://www.sitemaps.org" target="_blank">sitemaps.org</a>.
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">URL</th>
              <th style="width: 20%">Last Modified</th>
              <th style="width: 20%">Change Frequency</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="sitemap:urlset/sitemap:url">
              <tr>
                <td class="url-cell">
                  <xsl:variable name="itemURL">
                    <xsl:value-of select="sitemap:loc"/>
                  </xsl:variable>
                  <a href="{$itemURL}">
                    <xsl:value-of select="sitemap:loc"/>
                  </a>
                </td>
                <td>
                  <xsl:choose>
                    <xsl:when test="sitemap:lastmod">
                      <xsl:value-of select="concat(substring(sitemap:lastmod, 0, 11), concat(' ', substring(sitemap:lastmod, 12, 5)))"/>
                    </xsl:when>
                    <xsl:otherwise>-</xsl:otherwise>
                  </xsl:choose>
                </td>
                <td>
                  <xsl:choose>
                    <xsl:when test="sitemap:changefreq">
                      <xsl:value-of select="sitemap:changefreq"/>
                    </xsl:when>
                    <xsl:otherwise>-</xsl:otherwise>
                  </xsl:choose>
                </td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
        <div class="count">
          Total URLs: <strong><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></strong>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
