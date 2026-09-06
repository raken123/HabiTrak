.class public Lcom/hazelnut/mini/Chrome;
.super Landroid/webkit/WebChromeClient;

# Hands the page's <input type="file"> to Android's own picker. A WebView with
# no chrome client silently ignores the input, which would leave the whole app
# with nothing to do.

.field private final activity:Lcom/hazelnut/mini/MainActivity;


.method public constructor <init>(Lcom/hazelnut/mini/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lcom/hazelnut/mini/Chrome;->activity:Lcom/hazelnut/mini/MainActivity;
    return-void
.end method


.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 3

    iget-object v0, p0, Lcom/hazelnut/mini/Chrome;->activity:Lcom/hazelnut/mini/MainActivity;
    invoke-virtual {v0, p2}, Lcom/hazelnut/mini/MainActivity;->setFileCallback(Landroid/webkit/ValueCallback;)V

    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->createIntent()Landroid/content/Intent;
    move-result-object v1

    const/4 v2, 0x1
    invoke-virtual {v0, v1, v2}, Lcom/hazelnut/mini/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V

    return v2
.end method
