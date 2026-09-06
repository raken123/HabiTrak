// The Hazelnut launcher.
//
// Electron gives a desktop app a browser engine by shipping one — about 180 MB
// of it per platform. Every machine this runs on already has a Chromium, so
// this ships the application and borrows the engine instead: it serves the app
// from memory on a loopback port, opens it in a real chromeless app window, and
// exits when that window closes. The whole thing is a single file of a few
// megabytes with nothing to install.
//
// Everything the app does still happens on this machine. The one request that
// leaves is the call to Gemini, and it is proxied through here rather than made
// cross-origin from the page.

package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed all:payload
var payloadFS embed.FS

const (
	geminiHost = "https://generativelanguage.googleapis.com"

	// The window reports in while it is open. Missing a few in a row means it
	// has gone, and so should we.
	heartbeatGrace = 45 * time.Second
	heartbeatDead  = 12 * time.Second
)

var lastBeat atomic.Int64

func main() {
	appName := appDisplayName()

	root, err := fs.Sub(payloadFS, "payload")
	if err != nil {
		fatal(appName, fmt.Sprintf("The application files are missing from this build.\n\n%v", err))
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fatal(appName, fmt.Sprintf("Could not open a local port.\n\n%v", err))
	}
	addr := fmt.Sprintf("http://127.0.0.1:%d", listener.Addr().(*net.TCPAddr).Port)

	mux := http.NewServeMux()
	mux.Handle("/", noStore(http.FileServer(http.FS(root))))
	mux.Handle("/api/", geminiProxy())
	mux.HandleFunc("/__alive", func(w http.ResponseWriter, r *http.Request) {
		lastBeat.Store(time.Now().UnixMilli())
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/__closing", func(w http.ResponseWriter, r *http.Request) {
		// The page is going away. Give a reload a moment to arrive before
		// deciding the window is really gone.
		lastBeat.Store(time.Now().Add(-heartbeatDead + 4*time.Second).UnixMilli())
		w.WriteHeader(http.StatusNoContent)
	})

	server := &http.Server{Handler: mux}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Println("server:", err)
		}
	}()

	fmt.Printf("%s is running at %s\n", appName, addr)
	if err := openWindow(addr, appName); err != nil {
		notify(appName, fmt.Sprintf(
			"Could not open a window automatically.\n\nOpen this address in your browser instead:\n\n%s\n\n(%v)", addr, err))
	}

	waitForWindow()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

// noStore keeps a stale copy of the app out of the browser cache between
// versions; the files come from memory, so there is nothing to gain by caching.
func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// geminiProxy forwards /api/* to Google, so the page only ever talks to its own
// origin. The API key travels in the header the page sets; it is never read,
// stored or logged here.
func geminiProxy() http.Handler {
	target, _ := url.Parse(geminiHost)
	proxy := httputil.NewSingleHostReverseProxy(target)
	director := proxy.Director
	proxy.Director = func(r *http.Request) {
		director(r)
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/api")
		r.Host = target.Host
		r.Header.Del("Origin")
		r.Header.Del("Referer")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, fmt.Sprintf(`{"error":{"message":"Could not reach Gemini: %v"}}`, err), http.StatusBadGateway)
	}
	return http.StripPrefix("", proxy)
}

// waitForWindow blocks until the page stops reporting in.
func waitForWindow() {
	started := time.Now()
	for {
		time.Sleep(time.Second)
		beat := lastBeat.Load()
		if beat == 0 {
			// Nothing has connected yet; allow for a slow browser start.
			if time.Since(started) > heartbeatGrace {
				fmt.Println("No window connected. Exiting.")
				return
			}
			continue
		}
		if time.Since(time.UnixMilli(beat)) > heartbeatDead {
			return
		}
	}
}

// openWindow launches the app in a chromeless window where a Chromium is
// available, and falls back to the default browser where one is not.
func openWindow(addr, appName string) error {
	profile := filepath.Join(os.TempDir(), "hazelnut-window-"+sanitise(appName))
	args := []string{
		"--app=" + addr,
		"--user-data-dir=" + profile,
		"--no-first-run",
		"--no-default-browser-check",
		"--window-size=1440,900",
	}

	for _, browser := range chromiumCandidates() {
		path, err := exec.LookPath(browser)
		if err != nil {
			if _, statErr := os.Stat(browser); statErr != nil {
				continue
			}
			path = browser
		}
		cmd := exec.Command(path, args...)
		if err := cmd.Start(); err == nil {
			go func() { _ = cmd.Wait() }()
			return nil
		}
	}
	return openDefault(addr)
}

func chromiumCandidates() []string {
	switch runtime.GOOS {
	case "windows":
		local := os.Getenv("LOCALAPPDATA")
		files := os.Getenv("ProgramFiles")
		filesX86 := os.Getenv("ProgramFiles(x86)")
		return []string{
			filepath.Join(filesX86, `Microsoft\Edge\Application\msedge.exe`),
			filepath.Join(files, `Microsoft\Edge\Application\msedge.exe`),
			filepath.Join(files, `Google\Chrome\Application\chrome.exe`),
			filepath.Join(filesX86, `Google\Chrome\Application\chrome.exe`),
			filepath.Join(local, `Google\Chrome\Application\chrome.exe`),
			"msedge.exe", "chrome.exe",
		}
	case "darwin":
		return []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
	default:
		return []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"}
	}
}

func openDefault(addr string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", addr).Start()
	case "darwin":
		return exec.Command("open", addr).Start()
	default:
		return exec.Command("xdg-open", addr).Start()
	}
}

// appDisplayName reads the name from the executable, so one source builds both
// applications and each announces itself correctly.
func appDisplayName() string {
	exe, err := os.Executable()
	if err != nil {
		return "Hazelnut"
	}
	name := strings.TrimSuffix(filepath.Base(exe), filepath.Ext(exe))
	if strings.EqualFold(name, "HazelnutMini") {
		return "Hazelnut Mini"
	}
	if name == "" {
		return "Hazelnut"
	}
	return name
}

func sanitise(s string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' {
			return '-'
		}
		return r
	}, strings.ToLower(s))
}

func fatal(appName, message string) {
	fmt.Fprintf(os.Stderr, "%s could not start.\n\n%s\n", appName, message)
	notify(appName+" could not start", message)
	os.Exit(1)
}
