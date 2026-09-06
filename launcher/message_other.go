//go:build !windows

package main

import "fmt"

// Everywhere but Windows the process keeps a terminal, so a message can simply
// be printed.
func notify(title, message string) {
	fmt.Printf("\n%s\n%s\n", title, message)
}
