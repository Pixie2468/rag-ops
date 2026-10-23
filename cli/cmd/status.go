package cmd

import (
	"fmt"
	"os"

	"github.com/Pixie2468/rag-ops/internal/api"
	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check the health and connection status of the RAGOps backend",
	Run: func(cmd *cobra.Command, args []string) {
		baseURL := api.GetBaseURL()
		fmt.Printf("🔍 Checking RAGOps backend at %s...\n\n", baseURL)

		health, err := api.CheckHealth()
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Backend Status: OFFLINE\n")
			fmt.Fprintf(os.Stderr, "   %v\n\n", err)
			fmt.Println("💡 To start RAGOps locally, run:")
			fmt.Println("   docker compose up -d")
			fmt.Println("   # or")
			fmt.Println("   ./dev.sh")
			os.Exit(1)
		}

		fmt.Println("✅ Backend Status:   ONLINE")
		fmt.Printf("   Service:          %s\n", health.Service)
		
		if health.DatabaseConnected {
			fmt.Printf("   Database:         CONNECTED (%s)\n", health.DatabaseProvider)
		} else {
			fmt.Printf("   Database:         FALLBACK (%s)\n", health.DatabaseProvider)
		}

		if health.LLMJudgeConfigured {
			fmt.Println("   LLM Judge:        CONFIGURED (Gemini)")
		} else {
			fmt.Println("   LLM Judge:        NOT CONFIGURED (Set GEMINI_API_KEY for Stage 5)")
		}

		fmt.Printf("\n🌐 Web Dashboard:    http://localhost:3000\n")
		fmt.Printf("📚 API Docs:         %s/docs\n", baseURL)
	},
}

func init() {
	rootCmd.AddCommand(statusCmd)
}

