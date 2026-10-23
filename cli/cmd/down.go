package cmd

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var downCmd = &cobra.Command{
	Use:     "down",
	Aliases: []string{"stop"},
	Short:   "Stop the local containerized RAGOps stack",
	Run: func(cmd *cobra.Command, args []string) {
		dockerPath, err := exec.LookPath("docker")
		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠️  Docker is not installed or not in PATH.\n")
			os.Exit(1)
		}

		fmt.Println("🛑 Stopping RAGOps containers...")
		composeCmd := exec.Command(dockerPath, "compose", "down")
		composeCmd.Stdout = os.Stdout
		composeCmd.Stderr = os.Stderr

		if err := composeCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to stop docker compose: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ All RAGOps containers stopped.")
	},
}

func init() {
	rootCmd.AddCommand(downCmd)
}

