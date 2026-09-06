.class public Lcom/hazelnut/mini/Saver;
.super Ljava/lang/Object;

# The page hands a finished photograph back as base64. A WebView will not act on
# an <a download>, so this writes the bytes itself, into the app's own pictures
# directory — which needs no storage permission on any Android version.

.field private final activity:Landroid/app/Activity;


.method public constructor <init>(Landroid/app/Activity;)V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/hazelnut/mini/Saver;->activity:Landroid/app/Activity;
    return-void
.end method


.method public save(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
    .locals 6
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    const/4 v0, 0x0
    invoke-static {p1, v0}, Landroid/util/Base64;->decode(Ljava/lang/String;I)[B
    move-result-object v1

    iget-object v2, p0, Lcom/hazelnut/mini/Saver;->activity:Landroid/app/Activity;
    const-string v3, "Pictures"
    invoke-virtual {v2, v3}, Landroid/app/Activity;->getExternalFilesDir(Ljava/lang/String;)Ljava/io/File;
    move-result-object v2

    invoke-virtual {v2}, Ljava/io/File;->mkdirs()Z

    new-instance v3, Ljava/io/File;
    invoke-direct {v3, v2, p2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    new-instance v4, Ljava/io/FileOutputStream;
    invoke-direct {v4, v3}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
    invoke-virtual {v4, v1}, Ljava/io/FileOutputStream;->write([B)V
    invoke-virtual {v4}, Ljava/io/FileOutputStream;->close()V

    invoke-virtual {v3}, Ljava/io/File;->getAbsolutePath()Ljava/lang/String;
    move-result-object v5
    return-object v5
.end method
