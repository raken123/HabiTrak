//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// The Windows build is linked as a GUI application so no console window sits
// behind the app. That leaves nowhere for a message to go, so anything the user
// has to be told goes in a dialog instead. user32 is reached through the
// standard library, so this still needs no cgo and cross-compiles cleanly.
func notify(title, message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBox := user32.NewProc("MessageBoxW")

	titlePtr, err := syscall.UTF16PtrFromString(title)
	if err != nil {
		return
	}
	messagePtr, err := syscall.UTF16PtrFromString(message)
	if err != nil {
		return
	}
	const mbIconInformation = 0x00000040
	messageBox.Call(0,
		uintptr(unsafe.Pointer(messagePtr)),
		uintptr(unsafe.Pointer(titlePtr)),
		mbIconInformation)
}
