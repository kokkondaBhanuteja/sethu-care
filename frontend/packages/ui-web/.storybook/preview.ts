import type { Preview } from "@storybook/react-vite";
import "./preview.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: { disable: true },
  },
};

export default preview;
