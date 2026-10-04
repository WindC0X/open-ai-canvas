package main

import (
	"encoding/json"
	"fmt"

	"infinite-canvas/backend/internal/app"
	"infinite-canvas/backend/internal/model"
)

func main() {
	cfg := app.DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceOpenAIImage), "test-image-model")
	raw, err := json.Marshal(cfg)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(raw))
}
