package cmd

import "github.com/spf13/cobra"

var rootCmd = &cobra.Command{
	Use:   "ragops",
	Short: "RAGOPS Evaluation CLI",
}

func Execute() error {
	return rootCmd.Execute()
}
