# Self-Hosting

```sh
./trackx install
```

```sh
./load.sh
```

```sh
./run.sh
```

```sh
sudo systemctl enable docker-trackx-gateway.service \
  && sudo systemctl enable docker-trackx-api.service
```

```sh
sudo service docker-trackx-api stop \
  && sudo service docker-trackx-gateway stop
```

```sh
sudo service docker-trackx-gateway start \
  && sudo service docker-trackx-api start
```
