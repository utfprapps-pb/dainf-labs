package br.edu.utfpr.dainf.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("info")
public class InfoController {

    @Autowired(required = false)
    private BuildProperties buildProperties;

    @GetMapping
    public Map<String, String> getInfo() {
        Map<String, String> info = new LinkedHashMap<>();
        if (buildProperties != null) {
            info.put("version", buildProperties.getVersion());
            info.put("artifact", buildProperties.getArtifact());
            info.put("name", buildProperties.getName());
            info.put("buildTime", buildProperties.getTime().toString());
        }
        return info;
    }
}
