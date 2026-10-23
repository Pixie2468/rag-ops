package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/Pixie2468/rag-ops/internal/api"
	"github.com/spf13/cobra"
)

var noBrowser bool

var upCmd = &cobra.Command{
	Use:     "up",
	Aliases: []string{"start"},
	Short:   "Start the local RAGOps stack (Database + API + Web Dashboard) in the background",
	Run: func(cmd *cobra.Command, args []string) {
		// 1. Check if backend is already online
		if _, err := api.CheckHealth(); err == nil {
			fmt.Println("✓ RAGOps is already running!")
			fmt.Println("  • Web Dashboard: http://localhost:3000")
			fmt.Println("  • API Server:    http://localhost:8000")
			if !noBrowser {
				_ = openBrowser("http://localhost:3000")
			}
			return
		}

		// 2. Check for docker
		dockerPath, err := exec.LookPath("docker")
		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠️  Docker is not installed or not in PATH.\n\n")
			fmt.Println("💡 To start RAGOps without Docker, run:")
			fmt.Println("   ./dev.sh")
			os.Exit(1)
		}

		fmt.Println("🚀 Starting RAGOps stack with Docker Compose...")
		composeCmd := exec.Command(dockerPath, "compose", "up", "-d")
		composeCmd.Stdout = os.Stdout
		composeCmd.Stderr = os.Stderr

		if err := composeCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to start docker compose: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("\n⏳ Waiting for services to initialize...")
		for i := 0; i < 15; i++ {
			time.Sleep(1 * time.Second)
			if _, err := api.CheckHealth(); err == nil {
				fmt.Println("✅ RAGOps stack is online!")
				fmt.Println("  • Web Dashboard: http://localhost:3000")
				fmt.Println("  • REST API:      http://localhost:8000")
				fmt.Println("  • Swagger Docs:  http://localhost:8000/docs")
				if !noBrowser {
					_ = openBrowser("http://localhost:3000")
				}
				return
			}
		}

		fmt.Println("ℹ️  Containers started. If the services take longer on first start, check:")
		fmt.Println("   docker compose logs -f")
	},
}

func init() {
	upCmd.Flags().BoolVar(&noBrowser, "no-browser", false, "Do not automatically open the browser")
	rootCmd.AddCommand(upCmd)
}

