package cmd

import (
	"github.com/Pixie2468/rag-ops/internal/api"
	"github.com/spf13/cobra"
)

var apiURL string

var rootCmd = &cobra.Command{
	Use:   "ragops",
	Short: "RAGOps - Evaluation & Observability CLI for RAG Pipelines",
	Long: `RAGOps is a fail-fast evaluation platform for Retrieval-Augmented Generation (RAG).
Use this CLI to run evaluations, check service status, or launch the local Web Dashboard.`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		if apiURL != "" {
			api.SetBaseURL(apiURL)
		}
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&apiURL, "api-url", "u", "", "RAGOps backend URL (default: http://localhost:8000 or $RAGOPS_API_URL)")
}
