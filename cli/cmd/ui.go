package cmd

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/spf13/cobra"
)

func openBrowser(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default: // linux, bsd
		cmd = exec.Command("xdg-open", url)
	}

	return cmd.Start()
}

var uiCmd = &cobra.Command{
	Use:     "ui",
	Aliases: []string{"web", "dashboard"},
	Short:   "Open the RAGOps Web Dashboard in your default browser",
	Run: func(cmd *cobra.Command, args []string) {
		url := "http://localhost:3000"
		fmt.Printf("🚀 Opening RAGOps Web Dashboard at %s ...\n", url)
		if err := openBrowser(url); err != nil {
			fmt.Printf("💡 Visit the dashboard in your browser: %s\n", url)
		}
	},
}

func init() {
	rootCmd.AddCommand(uiCmd)
}

