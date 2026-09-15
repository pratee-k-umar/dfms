const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === "development";

    return {
        entry: "./static/app/main.tsx",
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: isDevelopment ? "[name].js" : "[name].[contenthash].js",
            publicPath: "/",
            clean: true,
        },
        resolve: {
            extensions: [".tsx", ".ts", ".js", ".jsx"],
            alias: {
                "@": path.resolve(__dirname, "static", "app"),
            },
            modules: [path.resolve(__dirname, "static/app"), "node_modules"],
        },
        module: {
            rules: [
                {
                    test: /\.(ts|tsx)$/,
                    use: {
                        loader: "ts-loader",
                        options: {
                            configFile: path.resolve(
                                __dirname,
                                "tsconfig.json",
                            ),
                        },
                    },
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    use: [
                        "style-loader",
                        "css-loader",
                        {
                            loader: "postcss-loader",
                            options: {
                                postcssOptions: {
                                    plugins: [
                                        require("tailwindcss"),
                                        require("autoprefixer"),
                                    ],
                                },
                            },
                        },
                    ],
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: "asset/resource",
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: "./static/app/index.html",
                favicon: path.resolve(__dirname, "static/app/public/favicon.png"),
                inject: "body",
            }),
        ],
        devServer: {
            port: 3000,
            hot: true,
            liveReload: true,
            historyApiFallback: true,
            proxy: [
                {
                    context: ["/api"],
                    target: "http://localhost:8000",
                    changeOrigin: true,
                },
            ],
            client: {
                overlay: {
                    errors: true,
                    warnings: false,
                },
                progress: true,
            },
            watchFiles: {
                paths: ["static/app/**/*"],
                options: {
                    usePolling: true,
                },
            },
        },
        devtool: isDevelopment ? "eval-source-map" : "source-map",
    };
};
