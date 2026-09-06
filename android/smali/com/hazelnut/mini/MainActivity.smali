.class public Lcom/hazelnut/mini/MainActivity;
.super Landroid/app/Activity;

# Hazelnut Mini on Android is the same page the desktop builds run, in a
# WebView. Everything the app does is JavaScript; this class exists to give that
# page a window, a file picker and somewhere to write a saved photograph.

.field private view:Landroid/webkit/WebView;

.field private fileCallback:Landroid/webkit/ValueCallback;


.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method


.method protected onCreate(Landroid/os/Bundle;)V
    .locals 4
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/hazelnut/mini/MainActivity;->view:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1

    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    # The page is loaded from a file: origin, which is opaque. Without this the
    # call to Gemini is refused as cross-origin before it is even sent.
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccessFromFileURLs(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V

    new-instance v3, Landroid/webkit/WebViewClient;
    invoke-direct {v3}, Landroid/webkit/WebViewClient;-><init>()V
    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    # Without a chrome client the page's file input does nothing at all.
    new-instance v3, Lcom/hazelnut/mini/Chrome;
    invoke-direct {v3, p0}, Lcom/hazelnut/mini/Chrome;-><init>(Lcom/hazelnut/mini/MainActivity;)V
    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    new-instance v3, Lcom/hazelnut/mini/Saver;
    invoke-direct {v3, p0}, Lcom/hazelnut/mini/Saver;-><init>(Landroid/app/Activity;)V
    const-string v1, "HazelnutAndroid"
    invoke-virtual {v0, v3, v1}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    const-string v3, "file:///android_asset/index.html"
    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Lcom/hazelnut/mini/MainActivity;->setContentView(Landroid/view/View;)V
    return-void
.end method


.method public setFileCallback(Landroid/webkit/ValueCallback;)V
    .locals 0
    iput-object p1, p0, Lcom/hazelnut/mini/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;
    return-void
.end method


.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 3
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V

    const/4 v0, 0x1
    if-ne p1, v0, :done

    iget-object v0, p0, Lcom/hazelnut/mini/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;
    if-eqz v0, :done

    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    const/4 v2, 0x0
    iput-object v2, p0, Lcom/hazelnut/mini/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;

    :done
    return-void
.end method


.method public onBackPressed()V
    .locals 1
    iget-object v0, p0, Lcom/hazelnut/mini/MainActivity;->view:Landroid/webkit/WebView;
    if-eqz v0, :leave

    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v0
    if-eqz v0, :leave

    iget-object v0, p0, Lcom/hazelnut/mini/MainActivity;->view:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void

    :leave
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method
