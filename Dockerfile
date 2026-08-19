FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS backend-build
WORKDIR /src
COPY NuGet.Config ./
COPY backend/TaxDesk.Api/TaxDesk.Api.csproj backend/TaxDesk.Api/
RUN dotnet restore backend/TaxDesk.Api/TaxDesk.Api.csproj --configfile NuGet.Config
COPY backend/TaxDesk.Api/ backend/TaxDesk.Api/
RUN dotnet publish backend/TaxDesk.Api/TaxDesk.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache icu-libs icu-data-full
COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "TaxDesk.Api.dll"]
